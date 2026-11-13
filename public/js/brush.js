// Le filtre « pinceau » : un Kuwahara anisotrope (Kyprianidis, Kang et Döllner), le même que celui des photos des
// fiches d'espèces, en version légère. Il ne passe pas sur l'écran à chaque image : on l'applique une fois à l'image
// d'une plante, au moment où elle est peinte. Coût nul ensuite, et des touches qui ne bougent pas.
//
// Deux passes WebGL2 sur une toile cachée :
//  1. l'orientation des formes en chaque point (tenseur de structure lissé) et leur netteté ;
//  2. le filtre : une ellipse alignée sur cette orientation, découpée en 8 secteurs ; on garde surtout les secteurs
//     les plus homogènes. Des aplats nets, des bords précis, pas de flou.
// Les couleurs sont traitées avec leur transparence (prémultipliées) : le bord d'une plante reste propre.
// Sans WebGL2, ou si le contexte se perd, l'image reste telle quelle.

const VERT = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// Passe 1 : tenseur de structure (Sobel), lissé sur 5 × 5, puis direction (cos, sin) et anisotropie.
const TENSOR = `#version 300 es
precision highp float;
uniform sampler2D src; uniform vec2 px; in vec2 uv; out vec4 o;
vec3 tensor(vec2 c) {
	vec4 a = texture(src, c + px * vec2(-1.0, -1.0)), b = texture(src, c + px * vec2(0.0, -1.0)), d = texture(src, c + px * vec2(1.0, -1.0));
	vec4 e = texture(src, c + px * vec2(-1.0, 0.0)), f = texture(src, c + px * vec2(1.0, 0.0));
	vec4 g = texture(src, c + px * vec2(-1.0, 1.0)), h = texture(src, c + px * vec2(0.0, 1.0)), i = texture(src, c + px * vec2(1.0, 1.0));
	vec4 sx = (d + 2.0 * f + i - a - 2.0 * e - g) * 0.25, sy = (g + 2.0 * h + i - a - 2.0 * b - d) * 0.25;
	return vec3(dot(sx, sx), dot(sy, sy), dot(sx, sy));
}
void main() {
	vec3 t = vec3(0.0); float n = 0.0;
	for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
		float w = exp(-float(x * x + y * y) / 4.5);
		t += w * tensor(uv + px * vec2(float(x), float(y)) * 1.5); n += w;
	}
	t /= n;
	float l1 = 0.5 * (t.x + t.y + sqrt((t.x - t.y) * (t.x - t.y) + 4.0 * t.z * t.z));
	float l2 = 0.5 * (t.x + t.y - sqrt((t.x - t.y) * (t.x - t.y) + 4.0 * t.z * t.z));
	vec2 v = vec2(l1 - t.x, -t.z);
	vec2 dir = length(v) > 1e-6 ? normalize(v) : vec2(0.0, 1.0);
	float A = (l1 + l2 > 1e-6) ? (l1 - l2) / (l1 + l2) : 0.0;
	o = vec4(dir * 0.5 + 0.5, A, 1.0);
}`;

// Passe 2 : le Kuwahara anisotrope, à poids polynomiaux (8 secteurs).
const KUWA = `#version 300 es
precision highp float;
uniform sampler2D src; uniform sampler2D tfm; uniform vec2 px; uniform float radius; uniform float amount;
in vec2 uv; out vec4 o;
const int R = 7;
void main() {
	vec4 t = texture(tfm, uv);
	vec2 dir = t.xy * 2.0 - 1.0; float A = t.z;
	const float alpha = 1.0;
	float a = radius * clamp((alpha + A) / alpha, 0.1, 2.0), b = radius * clamp(alpha / (alpha + A), 0.1, 2.0);
	float c = dir.x, s = dir.y;
	mat2 SR = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(c, -s, s, c);
	int mx = int(min(float(R), ceil(sqrt(a * a * c * c + b * b * s * s))));
	int my = int(min(float(R), ceil(sqrt(a * a * s * s + b * b * c * c))));
	const float zeta = 0.33, zc = 0.58;
	float eta = (zeta + cos(zc)) / (sin(zc) * sin(zc));
	vec4 m[8]; vec4 q[8]; float wsum[8];
	for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); q[k] = vec4(0.0); wsum[k] = 0.0; }
	for (int y = -R; y <= R; y++) for (int x = -R; x <= R; x++) {
		if (x < -mx || x > mx || y < -my || y > my) continue;
		vec2 v = SR * vec2(float(x), float(y));
		if (dot(v, v) > 0.25) continue;
		vec4 col = texture(src, uv + px * vec2(float(x), float(y)));
		float w[8]; float sum = 0.0, z, vxx, vyy;
		vxx = zeta - eta * v.x * v.x; vyy = zeta - eta * v.y * v.y;
		z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
		z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
		z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
		z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
		vec2 u = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
		vxx = zeta - eta * u.x * u.x; vyy = zeta - eta * u.y * u.y;
		z = max(0.0, u.y + vxx); w[1] = z * z; sum += w[1];
		z = max(0.0, -u.x + vyy); w[3] = z * z; sum += w[3];
		z = max(0.0, -u.y + vxx); w[5] = z * z; sum += w[5];
		z = max(0.0, u.x + vyy); w[7] = z * z; sum += w[7];
		float g = exp(-3.125 * dot(v, v)) / max(sum, 1e-6);
		for (int k = 0; k < 8; k++) { float wk = w[k] * g; m[k] += col * wk; q[k] += col * col * wk; wsum[k] += wk; }
	}
	vec4 acc = vec4(0.0); float tot = 0.0;
	for (int k = 0; k < 8; k++) {
		if (wsum[k] < 1e-6) continue;
		vec4 mean = m[k] / wsum[k];
		vec4 var = abs(q[k] / wsum[k] - mean * mean);
		float sigma2 = var.r + var.g + var.b + var.a;
		float wk = 1.0 / (1.0 + pow(1000.0 * 8.0 * sigma2, 4.0));
		acc += mean * wk; tot += wk;
	}
	vec4 orig = texture(src, uv);
	o = tot > 0.0 ? mix(orig, acc / tot, amount) : orig;
}`;

let G = null, dead = false;

function setup() {
	if (G || dead) return G;
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false });
		if (!gl) { dead = true; return null; }
		const sh = (type, code) => {
			const s = gl.createShader(type);
			gl.shaderSource(s, code); gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
			return s;
		};
		const prog = frag => {
			const p = gl.createProgram();
			gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
			gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
			if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
			return p;
		};
		const tex = () => {
			const t = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, t);
			for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
			return t;
		};
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.disable(gl.BLEND);
		G = { canvas, gl, pT: prog(TENSOR), pK: prog(KUWA), src: tex(), tfm: tex(), fbo: gl.createFramebuffer(), w: 0, h: 0 };
		canvas.addEventListener('webglcontextlost', () => { G = null; dead = true; });
	} catch (e) {
		console.warn('pinceau : WebGL indisponible', e);
		G = null; dead = true;
	}
	return G;
}

/** Le filtre est-il disponible sur cet appareil ? */
export const brushReady = () => !!setup();

/**
 * Passe l'image `canvas` (2D) au pinceau, sur place. `radius` : la taille des touches, en pixels de l'image.
 * `amount` : de 0 (rien) à 1 (tout le filtre). Renvoie false si le filtre n'a pas pu passer (l'image reste intacte).
 */
export function brushFilter(canvas, radius = 3, amount = 1) {
	const g = setup(), w = canvas.width, h = canvas.height;
	if (!g || !w || !h || radius < 0.5) return false;
	const { gl } = g;
	try {
		if (g.canvas.width < w || g.canvas.height < h) { g.canvas.width = Math.max(g.canvas.width, w); g.canvas.height = Math.max(g.canvas.height, h); }
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, g.src);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
		if (g.w !== w || g.h !== h) {
			gl.bindTexture(gl.TEXTURE_2D, g.tfm);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			g.w = w; g.h = h;
		}
		// 1. L'orientation, dans la texture tfm.
		gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g.tfm, 0);
		gl.viewport(0, 0, w, h);
		gl.useProgram(g.pT);
		gl.bindTexture(gl.TEXTURE_2D, g.src);
		gl.uniform1i(gl.getUniformLocation(g.pT, 'src'), 0);
		gl.uniform2f(gl.getUniformLocation(g.pT, 'px'), 1 / w, 1 / h);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		// 2. Le filtre, dans la toile cachée (coin bas gauche).
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(g.pK);
		gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.tfm);
		gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.src);
		gl.uniform1i(gl.getUniformLocation(g.pK, 'src'), 0);
		gl.uniform1i(gl.getUniformLocation(g.pK, 'tfm'), 1);
		gl.uniform2f(gl.getUniformLocation(g.pK, 'px'), 1 / w, 1 / h);
		gl.uniform1f(gl.getUniformLocation(g.pK, 'radius'), Math.min(7, radius));
		gl.uniform1f(gl.getUniformLocation(g.pK, 'amount'), amount);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		// Retour dans l'image 2D.
		const ctx = canvas.getContext('2d');
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'copy';
		ctx.drawImage(g.canvas, 0, g.canvas.height - h, w, h, 0, 0, w, h);
		ctx.restore();
		return true;
	} catch (e) {
		console.warn('pinceau : filtre abandonné', e);
		return false;
	}
}
