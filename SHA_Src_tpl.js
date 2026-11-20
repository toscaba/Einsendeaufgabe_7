var app = (function () {
    'use strict';

    var gl, prog;
    var models = [];
    var near = 0.5;
    var far = 35.0;
    var depthEnd = 15.0; // Feste Anzeige-Endtiefe für gut sichtbare Graustufen.
    var sceneRotate = [0.0, 0.0];
    var sceneMatrix = mat4.create();
    var sceneViewMatrix = mat4.create();
    var camera = {
        eye: [0, 2.4, 11.5],
        center: [0, 0.2, 0],
        up: [0, 1, 0],
        pMatrix: mat4.create(),
        vMatrix: mat4.create()
    };

    function start() {
        var canvas = document.getElementById('canvas');
        gl = canvas.getContext('webgl', { antialias: true }) || canvas.getContext('experimental-webgl');
        if (!gl) {
            alert('WebGL ist in diesem Browser nicht verfügbar.');
            return;
        }
        initShaderProgram();
        initModels();
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.CULL_FACE); // Auch bei unterschiedlichen Flächenorientierungen sichtbar.
        gl.clearColor(0.94, 0.96, 0.99, 1.0);
        gl.viewport(0, 0, canvas.width, canvas.height);
        mat4.perspective(camera.pMatrix, Math.PI / 3, canvas.width / canvas.height, near, far);
        gl.uniformMatrix4fv(prog.pMatrix, false, camera.pMatrix);
        gl.uniform1f(prog.near, near);
        gl.uniform1f(prog.far, far);
        gl.uniform1f(prog.depthStart, 2.5);
        setupControls();
        render();
    }

    function compileShader(type, id) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, document.getElementById(id).textContent);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(id + ': ' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function initShaderProgram() {
        prog = gl.createProgram();
        gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, 'vertexshader'));
        gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, 'fragmentshader'));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('Shader-Programm: ' + gl.getProgramInfoLog(prog));
        }
        gl.useProgram(prog);
        prog.position = gl.getAttribLocation(prog, 'aPosition');
        prog.pMatrix = gl.getUniformLocation(prog, 'uPMatrix');
        prog.mvMatrix = gl.getUniformLocation(prog, 'uMVMatrix');
        prog.near = gl.getUniformLocation(prog, 'uNear');
        prog.far = gl.getUniformLocation(prog, 'uFar');
        prog.depthStart = gl.getUniformLocation(prog, 'uDepthStart');
        prog.depthEnd = gl.getUniformLocation(prog, 'uDepthEnd');
        gl.enableVertexAttribArray(prog.position);
    }

    function createModel(geometry, color, translate, rotate, scale) {
        var model = {
            color: color,
            translate: translate,
            rotate: rotate,
            scale: scale,
            mMatrix: mat4.create(),
            mvMatrix: mat4.create()
        };
        geometry.createVertexData.call(model);
        model.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);
        model.ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesTris, gl.STATIC_DRAW);
        model.count = model.indicesTris.length;
        models.push(model);
    }

    // Eigene Würfelgeometrie: 8 Eckpunkte und 12 Dreiecke.
    var cube = {
        createVertexData: function () {
            this.vertices = new Float32Array([
                -1,-1,-1,  1,-1,-1,  1,1,-1, -1,1,-1,
                -1,-1, 1,  1,-1, 1,  1,1, 1, -1,1, 1
            ]);
            this.indicesTris = new Uint16Array([
                0,2,1,0,3,2, 4,5,6,4,6,7,
                0,1,5,0,5,4, 3,7,6,3,6,2,
                1,2,6,1,6,5, 0,4,7,0,7,3
            ]);
        }
    };

    function initModels() {
        // Bodengitter, Torus und mehrere Körper auf unterschiedlichen Z-Ebenen.
        createModel(plane, [0.82, 0.87, 0.94, 1], [0,-1.9,0], [0,0,0], [0.65,1,0.65]);
        createModel(torus, [0.25, 0.50, 0.88, 1], [-1.4,0.15,-1.7], [0.45,0.55,0], [1.05,1.05,1.05]);
        createModel(sphere, [0.96, 0.49, 0.39, 1], [-0.45,0.05,1.65], [0,0,0], [1.15,1.15,1.15]);
        createModel(cube, [0.37, 0.75, 0.66, 1], [1.25,-0.2,-0.45], [0.22,0.55,0.2], [0.9,0.9,0.9]);
        createModel(sphere, [0.98, 0.72, 0.35, 1], [1.85,0.55,-3.25], [0,0,0], [1.05,1.05,1.05]);
        createModel(sphere, [0.61, 0.46, 0.86, 1], [-1.8,-0.85,3.0], [0,0,0], [0.65,0.65,0.65]);
    }

    function setupControls() {
        document.getElementById('resetButton').addEventListener('click', function () {
            camera.eye = [0, 2.4, 11.5];
            camera.center = [0, 0.2, 0];
            sceneRotate = [0, 0];
            render();
        });
        window.addEventListener('keydown', function (evt) {
            var key = evt.key.toLowerCase();
            var step = 0.28;
            var angle = Math.PI / 36;
            var handled = true;
            switch (key) {
                case 'w': camera.eye[1] += step; camera.center[1] += step; break;
                case 's': camera.eye[1] -= step; camera.center[1] -= step; break;
                case 'a': camera.eye[0] -= step; camera.center[0] -= step; break;
                case 'd': camera.eye[0] += step; camera.center[0] += step; break;
                case 'arrowleft': sceneRotate[1] -= angle; break;
                case 'arrowright': sceneRotate[1] += angle; break;
                case 'arrowup': sceneRotate[0] -= angle; break;
                case 'arrowdown': sceneRotate[0] += angle; break;
                default: handled = false;
            }
            if (handled) {
                evt.preventDefault();
                render();
            }
        });
    }

    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        mat4.lookAt(camera.vMatrix, camera.eye, camera.center, camera.up);

        // Die Pfeiltasten drehen die gesamte Szene um einen gemeinsamen Ursprung.
        // Diese Transformation wird nur einmal pro Frame berechnet.
        mat4.identity(sceneMatrix);
        mat4.rotateY(sceneMatrix, sceneMatrix, sceneRotate[1]);
        mat4.rotateX(sceneMatrix, sceneMatrix, sceneRotate[0]);
        mat4.multiply(sceneViewMatrix, camera.vMatrix, sceneMatrix);

        gl.uniform1f(prog.depthEnd, depthEnd);
        for (var i = 0; i < models.length; i++) {
            var model = models[i];
            mat4.identity(model.mMatrix);
            mat4.translate(model.mMatrix, model.mMatrix, model.translate);
            mat4.rotateX(model.mMatrix, model.mMatrix, model.rotate[0]);
            mat4.rotateY(model.mMatrix, model.mMatrix, model.rotate[1]);
            mat4.rotateZ(model.mMatrix, model.mMatrix, model.rotate[2]);
            mat4.scale(model.mMatrix, model.mMatrix, model.scale);
            mat4.multiply(model.mvMatrix, sceneViewMatrix, model.mMatrix);
            gl.uniformMatrix4fv(prog.mvMatrix, false, model.mvMatrix);
            gl.bindBuffer(gl.ARRAY_BUFFER, model.vbo);
            gl.vertexAttribPointer(prog.position, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.ibo);
            gl.drawElements(gl.TRIANGLES, model.count, gl.UNSIGNED_SHORT, 0);
        }
        document.getElementById('cameraLabel').textContent =
            'Kamera X: ' + camera.eye[0].toFixed(1) + ' · Y: ' + camera.eye[1].toFixed(1);
    }

    return { start: start };
}());
