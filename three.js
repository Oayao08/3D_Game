<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Escape 3D Mejorado</title>
  <style>
    body { margin: 0; overflow: hidden; font-family: Arial, sans-serif; }
    canvas { display: block; outline: none; }
    #timer, #title {
      position: absolute;
      top: 10px;
      color: white;
      font-size: 20px;
      background: rgba(0,0,0,0.5);
      padding: 5px 10px;
      border-radius: 5px;
      user-select: none;
      z-index: 10;
    }
    #timer { left: 10px; }
    #title { right: 10px; font-family: 'Courier New', Courier, monospace; }
    #instructions {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.75);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      font-size: 18px;
      text-align: center;
      cursor: pointer;
      user-select: none;
      z-index: 20;
      max-width: 320px;
    }
    #overlay {
      position: fixed;
      top:0; left:0;
      width: 100%; height: 100%;
      pointer-events: none;
      background: rgba(255,0,0,0);
      transition: background 1s;
      z-index: 5;
    }
  </style>
</head>
<body>
  <div id="timer">Tiempo: 0.0 s</div>
  <div id="title">Escape 3D</div>
  <div id="overlay"></div>
  <div id="instructions">
    Haz clic para iniciar<br><br>
    Usa las flechas para moverte y el mouse para mirar
  </div>

  <audio id="bg-music" loop>
    <source src="tu-musica.mp3" type="audio/mpeg">
    Tu navegador no soporta audio.
  </audio>

  <audio id="alert-sound">
    <source src="alerta.mp3" type="audio/mpeg">
    Tu navegador no soporta audio.
  </audio>

  <script src="https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.1/examples/js/controls/PointerLockControls.js"></script>
  <script>
    let scene, camera, renderer, controls;
    let enemy = null, goal;
    let velocity = new THREE.Vector3();
    let direction = new THREE.Vector3();
    let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
    let enemySpeed = 0.03;
    let alerted = false;
    let startTime;
    let timerIntervalId = null;
    let speedIntervalId = null;
    let started = false;
    let animating = false;

    const speedMin = 0.02;
    const speedMax = 0.08;

    const overlay = document.getElementById("overlay");
    const instructions = document.getElementById("instructions");
    const timerDisplay = document.getElementById("timer");
    const bgMusic = document.getElementById("bg-music");
    const alertSound = document.getElementById("alert-sound");

    const clock = new THREE.Clock();

    init();

    function init() {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x88ccff);

      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.domElement.tabIndex = 0;
      document.body.appendChild(renderer.domElement);

      controls = new THREE.PointerLockControls(camera, renderer.domElement);
      scene.add(controls.getObject());

      document.addEventListener('pointerlockerror', () => {
        console.error('Error al bloquear el puntero');
        instructions.style.display = 'block';
      });

      instructions.addEventListener('click', () => {
        instructions.style.display = 'none';
        renderer.domElement.focus();
        controls.lock();
      });

      controls.addEventListener('lock', () => {
        document.body.style.cursor = 'none';
        if (!started) {
          started = true;
          startTime = Date.now();
          clock.start();
          if (!animating) {
            animating = true;
            animate();
          }
          changeEnemySpeed();
          updateTimer();
          bgMusic.currentTime = 0;
          bgMusic.play().catch(e => console.warn("Audio autoplay falló:", e));
        }
      });

      controls.addEventListener('unlock', () => {
        document.body.style.cursor = 'pointer';
        instructions.style.display = 'block';
        stopTimers();
        bgMusic.pause();
      });

      // Movimiento con flechas
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);

      // Evita scroll con flechas
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
        }
      }, { passive: false });

      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(10, 20, 10);
      light.castShadow = true;
      scene.add(light);

      const ambientLight = new THREE.AmbientLight(0x888888);
      scene.add(ambientLight);

      const floorGeometry = new THREE.PlaneGeometry(50, 50);
      const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      controls.getObject().position.set(0, 1.6, 0);

      const goalGeometry = new THREE.CylinderGeometry(0.8, 0.8, 1, 32);
      const goalMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      goal = new THREE.Mesh(goalGeometry, goalMaterial);
      goal.position.set(-7, 0.5, -7);
      goal.receiveShadow = true;
      scene.add(goal);

      const loader = new THREE.TextureLoader();
      loader.load('https://via.placeholder.com/256x256.png?text=Enemigo', texture => {
        const enemyGeometry = new THREE.BoxGeometry(3, 3, 3);
        const enemyMaterial = new THREE.MeshPhongMaterial({ map: texture });
        enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
        enemy.position.set(5, 1.5, 5);
        enemy.castShadow = true;
        scene.add(enemy);
      });

      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }

    function onKeyDown(event) {
      switch (event.key) {
        case 'ArrowUp': moveForward = true; break;
        case 'ArrowDown': moveBackward = true; break;
        case 'ArrowLeft': moveLeft = true; break;
        case 'ArrowRight': moveRight = true; break;
      }
    }

    function onKeyUp(event) {
      switch (event.key) {
        case 'ArrowUp': moveForward = false; break;
        case 'ArrowDown': moveBackward = false; break;
        case 'ArrowLeft': moveLeft = false; break;
        case 'ArrowRight': moveRight = false; break;
      }
    }

    function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();

      velocity.set(0, 0, 0);
      direction.z = Number(moveBackward) - Number(moveForward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize();

      if (moveForward || moveBackward) velocity.z -= direction.z * 5 * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * 5 * delta;

      controls.moveRight(-velocity.x);
      controls.moveForward(-velocity.z);

      const playerPos = controls.getObject().position;

      // Movimiento enemigo
      if (enemy) {
        const dx = playerPos.x - enemy.position.x;
        const dz = playerPos.z - enemy.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.3) {
          enemy.position.x += (dx / dist) * enemySpeed;
          enemy.position.z += (dz / dist) * enemySpeed;
        } else {
          alert(`¡Te ha atrapado! Tiempo: ${((Date.now() - startTime) / 1000).toFixed(1)} s`);
          resetGame();
        }
      }

      // Llegada a la meta
      const dxg = playerPos.x - goal.position.x;
      const dzg = playerPos.z - goal.position.z;
      const distGoal = Math.hypot(dxg, dzg);
      if (distGoal < 1.2) {
        alert(`¡Has escapado! Tiempo: ${((Date.now() - startTime) / 1000).toFixed(1)} s`);
        resetGame();
      }

      const timePassed = (Date.now() - startTime) / 1000;
      if (timePassed >= 20 && !alerted) {
        overlay.style.background = "rgba(255, 0, 0, 0.3)";
        alertSound.play().catch(e => console.warn("No se pudo reproducir el sonido de alerta:", e));
        enemySpeed = 0.15;
        alerted = true;
      }

      renderer.render(scene, camera);
    }

    function resetGame() {
      if (enemy) enemy.position.set(5, 1.5, 5);
      controls.getObject().position.set(0, 1.6, 0);
      startTime = Date.now();
      overlay.style.background = "rgba(255, 0, 0, 0)";
      alerted = false;
      bgMusic.currentTime = 0;
      bgMusic.play().catch(() => {});
    }

    function changeEnemySpeed() {
      if (speedIntervalId) clearInterval(speedIntervalId);
      speedIntervalId = setInterval(() => {
        if (!alerted) {
          enemySpeed = Math.random() * (speedMax - speedMin) + speedMin;
          console.log("Nueva velocidad enemigo:", enemySpeed.toFixed(3));
        }
      }, 3000);
    }

    function updateTimer() {
      if (timerIntervalId) clearInterval(timerIntervalId);
      timerIntervalId = setInterval(() => {
        if (!started) return;
        const time = ((Date.now() - startTime) / 1000).toFixed(1);
        timerDisplay.textContent = `Tiempo: ${time} s`;
      }, 100);
    }

    function stopTimers() {
      clearInterval(timerIntervalId);
      clearInterval(speedIntervalId);
      timerIntervalId = null;
      speedIntervalId = null;
    }
  </script>
</body>
</html>
