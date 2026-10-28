import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/sculpture.module.css";

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

mat3 rotateX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

mat3 rotateY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

mat3 rotateZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float map(vec3 p) {
  // Smooth mouse and continuous time rotation
  mat3 rot = rotateY(u_time * 0.32 + u_mouse.x * 1.8) * rotateX(0.25 + u_mouse.y * 1.2);
  vec3 rp = rot * p;

  // Interlocking 3D Ribbon Loops
  vec3 p1 = rotateX(0.55) * rotateY(0.35) * rp;
  float d1 = sdTorus(p1, vec2(1.18, 0.18));

  vec3 p2 = rotateY(1.3) * rotateZ(0.75) * rp;
  float d2 = sdTorus(p2, vec2(1.18, 0.18));

  vec3 p3 = rotateZ(2.1) * rotateX(1.1) * rp;
  float d3 = sdTorus(p3, vec2(1.18, 0.18));

  return smin(smin(d1, d2, 0.32), d3, 0.32);
}

vec3 calcNormal(vec3 p) {
  float d = map(p);
  vec2 e = vec2(0.002, 0.0);
  vec3 n = d - vec3(
    map(p - e.xyy),
    map(p - e.yxy),
    map(p - e.yyx)
  );
  return normalize(n);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
  
  vec3 ro = vec3(0.0, 0.0, 3.6);
  vec3 rd = normalize(vec3(uv, -1.45));
  
  float t = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 72; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) {
      hit = 1.0;
      break;
    }
    t += d * 0.75;
    if (t > 7.0) break;
  }
  
  if (hit > 0.5) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    
    vec3 lightDir = normalize(vec3(1.6, 2.8, 2.2));
    vec3 fillDir = normalize(vec3(-2.0, -1.0, 1.0));
    vec3 viewDir = -rd;
    
    float diff = max(dot(n, lightDir), 0.0);
    float fill = max(dot(n, fillDir), 0.0) * 0.4;
    
    vec3 ref = reflect(-lightDir, n);
    float spec = pow(max(dot(ref, viewDir), 0.0), 32.0) * 0.95;
    
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.2);
    
    // Warm copper, coral, and glowing amber gradient
    vec3 baseColor = mix(vec3(0.96, 0.42, 0.24), vec3(0.98, 0.68, 0.35), n.y * 0.5 + 0.5);
    vec3 ambient = vec3(0.12, 0.04, 0.02);
    
    vec3 col = ambient + baseColor * (diff + fill) + vec3(1.0, 0.9, 0.8) * spec + vec3(1.0, 0.52, 0.28) * fresnel * 1.5;
    
    // Translucent depth blend
    col = mix(col, vec3(1.0, 0.4, 0.18), fresnel * 0.35);
    
    gl_FragColor = vec4(col, 0.96);
  } else {
    // Ambient warm halo
    float dCenter = length(uv);
    float glow = exp(-dCenter * 2.6) * 0.22;
    vec3 glowCol = vec3(1.0, 0.48, 0.22) * glow;
    gl_FragColor = vec4(glowCol, glow * 1.4);
  }
}
`;

export default function SangamSculpture3D({ className }) {
  const canvasRef = useRef(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl", { alpha: true, antialias: true }) ||
      canvas.getContext("experimental-webgl", { alpha: true, antialias: true });

    if (!gl) {
      setHasWebGL(false);
      return;
    }

    // Compile Shader Helper
    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Shader compilation error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

    if (!vertShader || !fragShader) {
      setHasWebGL(false);
      return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Program link error:", gl.getProgramInfoLog(program));
      setHasWebGL(false);
      return;
    }

    gl.useProgram(program);

    // Full-screen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPosition = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uMouse = gl.getUniformLocation(program, "u_mouse");
    const uTime = gl.getUniformLocation(program, "u_time");

    // Enable blending for transparent background
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let animationFrameId;
    let startTime = performance.now();

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Resize handler
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const displayWidth = Math.floor(width * dpr);
      const displayHeight = Math.floor(height * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }

    resize();
    window.addEventListener("resize", resize);

    // Mouse parallax tracking
    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current.targetX = Math.max(-1, Math.min(1, x));
      mouseRef.current.targetY = Math.max(-1, Math.min(1, y));
    }

    window.addEventListener("mousemove", onMouseMove);

    // IntersectionObserver to pause rendering when out of viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    // Render loop
    function render(now) {
      if (isVisibleRef.current) {
        // Smooth mouse damping
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

        const elapsed = (now - startTime) * 0.001;
        const timeVal = prefersReducedMotion ? 0.0 : elapsed;

        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
        gl.uniform1f(uTime, timeVal);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      observer.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <div className={`${styles.sculptureContainer} ${className || ""}`}>
      {hasWebGL ? (
        <canvas ref={canvasRef} className={styles.webglCanvas} />
      ) : (
        <div className={styles.staticFallback}>
          <img
            src="/assets/sculpture_ref.jpg"
            alt="Sangam Interlocking 3D Connection Sculpture"
            className={styles.fallbackImg}
          />
        </div>
      )}
    </div>
  );
}
