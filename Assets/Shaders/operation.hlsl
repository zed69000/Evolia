#ifndef ROTATE_AROUND_TRANSFORM_INCLUDED
#define ROTATE_AROUND_TRANSFORM_INCLUDED

// 32 bits – on utilise out pour la sortie
void RotateAroundTransform_float(
    float3 PositionWS,   // position en monde
    float3 PivotWS,      // pivot passé par PropertyBlock
    float  AngleDeg,     // angle en degrés
    out   float3 OutWS   // résultat
)
{
    // 1) Centrage sur le pivot
    float3 p = PositionWS - PivotWS;

    // 2) Rotation dans le plan X-Y
    float rad = radians(AngleDeg);
    float  s  = sin(rad);
    float  c  = cos(rad);

    p.xy = float2(
        p.x * c - p.y * s,
        p.x * s + p.y * c
    );

    // 3) Décentrage
    OutWS = p;
}
#endif // ROTATE_AROUND_TRANSFORM_INCLUDED