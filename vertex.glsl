precision mediump float;

varying vec3 v_normal;

uniform vec3 u_lightDirection;
uniform vec4 u_color;

void main() {
    float light = max(dot(normalize(v_normal), normalize(u_lightDirection)), 0.0);
    gl_FragColor = vec4(u_color.rgb * light, u_color.a);
}