/****************************************************
 * PART 1: STATIC BACKGROUND 
 ****************************************************/
const bgCanvas = document.getElementById("starryBg");
const bgCtx = bgCanvas.getContext("2d");
const STATIC_STAR_COUNT = 3000;

function drawStaticStars() {
  for (let i = 0; i < STATIC_STAR_COUNT; i++) {
    const x = Math.random() * bgCanvas.width;
    const y = Math.random() * bgCanvas.height;
    const radius = Math.random() * 0.4 + 0.01;
    bgCtx.beginPath();
    bgCtx.arc(x, y, radius, 0, 2 * Math.PI);
    bgCtx.fillStyle = "white";
    bgCtx.fill();
  }
}

drawStaticStars();

/****************************************************
 * PART 2: FLICKER STARS LAYER 
 ****************************************************/
const flickerCanvas = document.getElementById("flickerCanvas");
const flickerCtx = flickerCanvas.getContext("2d");
const FLICKER_STAR_COUNT = 1000; 
const FLICKER_INTENSITY = 0.1;
const flickerStars = [];

function createFlickerStars() {
  for (let i = 0; i < FLICKER_STAR_COUNT; i++) {
    flickerStars.push({
      x: Math.random() * flickerCanvas.width,
      y: Math.random() * flickerCanvas.height,
      radius: Math.random() * 0.7 + 0.3,
      opacity: Math.random(),
    });
  }
}

function drawFlickerStars() {
  // Clear just this flicker canvas each frame
  flickerCtx.clearRect(0, 0, flickerCanvas.width, flickerCanvas.height);

  flickerStars.forEach((star) => {
    // Update opacity for flicker
    star.opacity +=
      Math.random() * FLICKER_INTENSITY * 2 - FLICKER_INTENSITY;
    if (star.opacity > 1) star.opacity = 1;
    if (star.opacity < 0) star.opacity = 0;

    flickerCtx.beginPath();
    flickerCtx.arc(star.x, star.y, star.radius, 0, 2 * Math.PI);
    flickerCtx.fillStyle = `rgba(255,255,255,${star.opacity})`;
    flickerCtx.fill();
  });
}

//TODO
//Refactor to update loop with timestamp if statement !
//Refactor to update loop with timestamp if statement !
//Refactor to update loop with timestamp if statement !
function animateFlicker() {
  setTimeout(() => {
    requestAnimationFrame(animateFlicker);
    drawFlickerStars();
  }, 1000 / 20);
}

// Init flicker stars & start flicker loop
createFlickerStars();
animateFlicker();

/****************************************************
 * PART 3: CANVAS GRAVITY/ORBIT SIMULATION 
 ****************************************************/
const canvas = document.getElementById("gravityCanvas");
const ctx = canvas.getContext("2d");
const centerMassImage = new Image();
centerMassImage.src = "./img/full-moon_640.jpg"; 

function drawCenterMassWithImage(obj) {
  if (centerMassImage.complete) {
    ctx.save();
    //Clip the canvas to the circular shape of the center mass
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    //Draw a larger image centered at the center mass
    const scaleFactor = 1.16;
    const imageWidth = obj.radius * 2 * scaleFactor;
    const imageHeight = obj.radius * 2 * scaleFactor;

    ctx.drawImage(
      centerMassImage,
      obj.x - imageWidth / 2,
      obj.y - imageHeight / 2,
      imageWidth,
      imageHeight
    );

    //Restore the context to remove the clipping
    ctx.restore();
  } else {
    // If the image isn't loaded yet, draw a fallback circle
    drawObject(obj, "black");
  }
}


/****************************************************
 * PART 4: KEY PRESS / CONTROLS LOGIC
 ****************************************************/
const keysPressed = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
};

document.addEventListener("keydown", (e) => {
  if (e.key in keysPressed) {
    keysPressed[e.key] = true;
  }
  if (e.code === "Space") {
e.preventDefault(); // Prevent default scrolling behavior
const button = document.getElementById("resetButtonMainDivId");
button.classList.add('space-active'); // Add active style

}
});
document.addEventListener("keyup", (e) => {
  if (e.key in keysPressed) {
    keysPressed[e.key] = false;
  }
  if (
    !keysPressed.ArrowLeft &&
    !keysPressed.ArrowRight &&
    !keysPressed.ArrowUp &&
    !keysPressed.ArrowDown
  ) {
    // Once thrust is truly finished, recalc the future path:
    futurePath = calculateFuturePath();
  }
  if (e.code === "Space") {
const button = document.getElementById("resetButtonMainDivId");
button.classList.remove('space-active'); // Remove active style
button.click(); // Trigger click handler
}
  
});

//Analog reset button dynamic styling
document.getElementById('squareborderWrapper').addEventListener('click', function() {
this.classList.toggle('active');
});
// Key and CONTAINER EVENT LISTENERS END


/****************************************************
 * PART 5: MAIN PHYSICS: CENTERMASS, THRUST, SPACESHIP
 ****************************************************/

const G = 0.5;
const THRUST_FORCE = 0.07;
const THRUST_DISPLAY_TIME = 15;
const trace = [];
const MAX_TRACE_LENGTH = 300;
let debris = [];

const centerMass = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 95,
  mass: 2600,
};

//Spaceship
const particle = {
  x: 50,
  y: 20,
  radius: 6,
  mass: 0.5,
  vx: 0,
  vy: 0,
  thrust: {
    active: false,
    direction: 0,
    timer: 0,
  },
};

function drawObject(obj, color) {
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawThrust(particle) {
  if (particle.thrust.timer > 0) {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    // ctx.rotate(particle.thrust.direction);

    ctx.beginPath();
    ctx.moveTo(-particle.radius, 0);
    ctx.lineTo(-particle.radius - 15, -5);
    ctx.lineTo(-particle.radius - 20, 0);
    ctx.lineTo(-particle.radius - 15, 5);
    ctx.closePath();

    ctx.fillStyle = "orange";
    ctx.fill();

    ctx.restore();
    particle.thrust.timer--;
  }
}

function calculateGravity() {
  const dx = centerMass.x - particle.x;
  const dy = centerMass.y - particle.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Check for collision
  if (distance < centerMass.radius + particle.radius) {
    const collisionSpeed = getVelocityMaginute(particle.vx, particle.vy);

    if (collisionSpeed >= COLLISION_SPEED_THRESHOLD) {
      explodeShip(collisionSpeed, particle.vx, particle.vy);
      deleteCollisionWarningButton();
      displayResetButton();
    } else {
      particle.vx = 0;
      particle.vy = 0;
    }
    return;
  }

  // Original gravity calculations
  const force =
    (G * (centerMass.mass * particle.mass)) / (distance * distance);
  const angle = Math.atan2(dy, dx);

  particle.vx += force * Math.cos(angle);
  particle.vy += force * Math.sin(angle);
}

function getRandomRGBColor() {
    const colors = [
        'rgb(63, 63, 255)', 
        'rgb(153, 153, 153)' 
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function explodeShip(collisionSpeed, particlevx, particlevy) {
  particle.isActive = false;

  // Creating debris pieces
  const numDebris = Math.floor(Math.random() * 11) + 180; 
  for (let i = 0; i < numDebris; i++) {

    const radius = Math.random() + 0.12;

    debris.push({
      x: particle.x,
      y: particle.y,
      vx: (Math.random() - 0.55 + particlevx * 0.05) * collisionSpeed,
      vy: (Math.random() - 0.55 + particlevy * 0.05) * collisionSpeed,
      radius: radius,
      mass: Math.random()* radius*0.2 + 0.1,
      color: `${getRandomRGBColor()}`,
      isActive: true,
    });
  }
}


function applyThrust(direction) {
  particle.thrust.active = true;
  particle.thrust.direction = direction;
  particle.thrust.timer = THRUST_DISPLAY_TIME;

  particle.vx += THRUST_FORCE * Math.cos(direction);
  particle.vy += THRUST_FORCE * Math.sin(direction);
}

// Draw a fade-like trace behind the particle
function drawTrace() {
  if (trace.length < 2) return;
  for (let i = 0; i < trace.length - 1; i++) {
    let t = i / (trace.length - 1); // 0..1
    let alpha = t / 1.5; // older => more transparent
    let lineWidth = 0.1 + 2 * t; // older => thinner

    ctx.beginPath();
    ctx.moveTo(trace[i].x, trace[i].y);
    ctx.lineTo(trace[i + 1].x, trace[i + 1].y);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

// Show flickering thrust-triangles near the particle if keys are pressed
function drawThrustIndicators(p) {
  const flickerAlpha = 0.3 + 0.5 * Math.random();
  ctx.fillStyle = `rgba(255, 255, 0, ${flickerAlpha})`;
  const offset = p.radius + 5;

  // Up
  if (keysPressed.ArrowUp) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + offset);
    ctx.lineTo(p.x - 5, p.y + offset + 8);
    ctx.lineTo(p.x + 5, p.y + offset + 8);
    ctx.closePath();
    ctx.fill();
  }
  // Down
  if (keysPressed.ArrowDown) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - offset);
    ctx.lineTo(p.x - 5, p.y - offset - 8);
    ctx.lineTo(p.x + 5, p.y - offset - 8);
    ctx.closePath();
    ctx.fill();
  }
  // Right
  if (keysPressed.ArrowRight) {
    ctx.beginPath();
    ctx.moveTo(p.x - offset, p.y);
    ctx.lineTo(p.x - offset - 8, p.y - 5);
    ctx.lineTo(p.x - offset - 8, p.y + 5);
    ctx.closePath();
    ctx.fill();
  }
  // Left
  if (keysPressed.ArrowLeft) {
    ctx.beginPath();
    ctx.moveTo(p.x + offset, p.y);
    ctx.lineTo(p.x + offset + 8, p.y - 5);
    ctx.lineTo(p.x + offset + 8, p.y + 5);
    ctx.closePath();
    ctx.fill();
  }
}


function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (particle.isActive) {
    calculateGravity();

    if (!missionTimer.running) {
      missionTimer.start(); // Start the timer if it hasn't started
    }

    // Existing movement code
    let thrustX = 0,
      thrustY = 0;
    const isThrusting = Object.values(keysPressed).some((key) => key);

    // Only apply thrust if we have fuel
    if (updateFuel(missionTimer.getTime(), isThrusting)) {
      if (keysPressed.ArrowLeft) thrustX -= THRUST_FORCE;
      if (keysPressed.ArrowRight) thrustX += THRUST_FORCE;
      if (keysPressed.ArrowUp) thrustY -= THRUST_FORCE;
      if (keysPressed.ArrowDown) thrustY += THRUST_FORCE;

      particle.vx += thrustX;
      particle.vy += thrustY;
    }

    particle.x += particle.vx;
    particle.y += particle.vy;
  } else {
    missionTimer.stop();
  }

  debris.forEach((debrisPiece, index) => {
    // If already landed, skip gravity/velocity:
    if (debrisPiece.landed) {
      return;
    }

    // ... otherwise do the usual gravity stuff ...
    const dx = centerMass.x - debrisPiece.x;
    const dy = centerMass.y - debrisPiece.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If debris intersects the planet:
    if (distance <= centerMass.radius + debrisPiece.radius) {
      // Snap to surface, set velocity = 0, mark landed
      const angle = Math.atan2(dy, dx);
      debrisPiece.x =
        centerMass.x -
        (centerMass.radius + debrisPiece.radius) * Math.cos(angle);
      debrisPiece.y =
        centerMass.y -
        (centerMass.radius + debrisPiece.radius) * Math.sin(angle);
      debrisPiece.vx = 0;
      debrisPiece.vy = 0;
      debrisPiece.landed = true;
    } else {
      // Otherwise apply gravity as normal
      const force =
        (G * (centerMass.mass * debrisPiece.mass)) /
        (distance * distance);
      const angle = Math.atan2(dy, dx);
      debrisPiece.vx += force * Math.cos(angle);
      debrisPiece.vy += force * Math.sin(angle);
      debrisPiece.x += debrisPiece.vx;
      debrisPiece.y += debrisPiece.vy;
    }
  });

  // Keep track of trail
  trace.push({ x: particle.x, y: particle.y });
  if (trace.length > MAX_TRACE_LENGTH) {
    trace.shift();
  }

  // Draw all elements
  drawTrace();
  drawCenterMassWithImage(centerMass);

  drawFuturePath();

  // Draw spaceship if active
  if (particle.isActive) {
    drawObject(particle, "blue");
    drawThrustIndicators(particle);
  }

  // Draw debris
  debris.forEach((debrisPiece) => {
    drawObject(debrisPiece, debrisPiece.color);
  });

  
  drawVelocityInfo(particle.vx, particle.vy);

  // Update timer display each frame
  missionTimer.updateDisplay();

  reduceOxygenAmount(missionTimer.getTime());

  fpsCounter.trackFrame();

  requestAnimationFrame(update);
}




/****************************************************
 * PART 6: UI / HUD
 ****************************************************/

function displayResetButton() {
    document.getElementById("resetButtonMainDivId").style.display = "flex";
  }
  function hideDisplayButton() {
    document.getElementById("resetButtonMainDivId").style.display = "none";
  }

function drawVelocityInfo(vx, vy) {
  currentVelocity = getVelocityMaginute(vx, vy);
  // calc magnitude of velocity:
  let velocityMagnitude = getVelocityMaginute(vx, vy);

  let pElement = document.getElementById("velocityInfoId");
  updateVelocityHUD(velocityMagnitude);

  // Split the number into whole and decimal parts
  let wholePart = Math.floor(velocityMagnitude);
  let decimalPart = (velocityMagnitude - wholePart)
  .toFixed(2)
    .substring(2);

  // Combine with dot separator
  pElement.textContent = `${wholePart} . ${decimalPart}`;
}

const OXYGEN_REDUCTION_RATE = 0.5; // % per second
let lastOxygenUpdate = 0;

function reduceOxygenAmount(elapsedTime) {
  // Only reduce oxygen if particle is active
  if (!particle.isActive) return;

  const currentSecond = Math.floor(elapsedTime / 1000);

  if (currentSecond > lastOxygenUpdate) {
    let oxygenContainer = document.getElementById("oxygenAmountDivId");
    let currentPercentage =
      parseFloat(oxygenContainer.style.height) || 80; // Default to 80 if not set

    // Reduce by rate and ensure we don't go below 0
    let newPercentage = Math.max(
      0,
      currentPercentage - OXYGEN_REDUCTION_RATE
    );
    oxygenContainer.style.height = newPercentage + "%";

    lastOxygenUpdate = currentSecond;

    // Check if oxygen is depleted
    if (newPercentage <= 0) {
      // Handle oxygen depletion
      particle.isActive = false;
      missionTimer.stop();
      displayResetButton();
    }
  }
}

///For resizing and to scale velocity
document.addEventListener("DOMContentLoaded", () => {
    // Initial positioning
    updateVelocityHUD(0);
    window.dispatchEvent(new Event("resize"));
  
    
  });

/////////Fuel Reduction Start /////////

const FUEL_REDUCTION_RATE = 0.6; // % per 0.1 second
let lastFuelUpdateTime = 0;

function getFuelLevel() {
  let fuelContainer = document.getElementById("fuelAmountDivId");
  return parseFloat(fuelContainer.style.height) || 80;
}

function setFuelLevel(level) {
  let fuelContainer = document.getElementById("fuelAmountDivId");
  fuelContainer.style.height = Math.max(0, level) + "%";
}

function updateFuel(currentTime, isThrusting) {
  if (!isThrusting) return true;

  const currentTenth = Math.floor(currentTime / 100);
  const currentFuel = getFuelLevel();

  if (currentFuel <= 0) return false;

  if (currentTenth > lastFuelUpdateTime) {
    setFuelLevel(currentFuel - FUEL_REDUCTION_RATE);
    lastFuelUpdateTime = currentTenth;
  }

  return currentFuel > 0;
}
/////////Fuel Reduction End /////////

function updateVelocityHUD(velocityMagnitude) {
  const velocityStepsDiv = document.getElementById("velocityStepsDivId");
  const container = document.getElementById("velocityMainDivId");

  // Get fresh measurements each time
  const stepHeight = document.querySelector(
    ".single-speed-div-class"
  ).offsetHeight;
  const containerHeight = container.offsetHeight;

  const baseOffset = containerHeight+stepHeight+4;
  const translateYValue =
    (baseOffset - velocityMagnitude * stepHeight) * -1;

  velocityStepsDiv.style.transform = `translateY(${translateYValue}px)`;
}

function getVelocityMaginute(vx, vy) {
  let velocityMagnitude = Math.sqrt(vx * vx + vy * vy);
  return velocityMagnitude;
}

function setOxygenLevel(amount){
  let oxygenContainer = document.getElementById("oxygenAmountDivId");
  oxygenContainer.style.height = `${amount}%`;
  lastOxygenUpdate = 0;
}

/****************************************************
 * PART 7: FUTURE PATH PROJECTION
 ****************************************************/
let futurePath = []; // Array of {x, y} points for future path
let collisionPoint = null; // Store the collision point
let collisionSpeed = 0; // Store the speed at collision
const COLLISION_SPEED_THRESHOLD = 1.5; // Tweak this value as needed

function calculateFuturePath() {
  if (!particle.isActive) return [];
  // Backup current real state
  const backup = {
    x: particle.x,
    y: particle.y,
    vx: particle.vx,
    vy: particle.vy,
  };

  const tempPath = [];
  const steps = 3000; // Number of steps to predict
  const dt = 1; // Time increment, e.g., "1 frame’s worth"

  collisionPoint = null; // Reset collision point
  collisionSpeed = 0; // Reset collision speed

  // Simulate forward in small steps
  for (let i = 0; i < steps; i++) {
    // Apply gravity 
    const dx = centerMass.x - particle.x;
    const dy = centerMass.y - particle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const force = (G * (centerMass.mass * particle.mass)) / (dist * dist);
    const angle = Math.atan2(dy, dx);
    particle.vx += force * Math.cos(angle) * dt;
    particle.vy += force * Math.sin(angle) * dt;

    // Update position
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;

    // Check for collision
    if (dist < centerMass.radius + particle.radius) {
      collisionPoint = { x: particle.x, y: particle.y };
      collisionSpeed = Math.sqrt(
        particle.vx * particle.vx + particle.vy * particle.vy
      ); 

      document.getElementById("collisionMainDivId").style.display =
        "flex";
      break; // Stop simulating further
    }
    document.getElementById("collisionMainDivId").style.display = "none";
    // Push to path array
    tempPath.push({ x: particle.x, y: particle.y });
  }

  // Restore the real simulation state
  particle.x = backup.x;
  particle.y = backup.y;
  particle.vx = backup.vx;
  particle.vy = backup.vy;

  // Return predicted future path
  return tempPath;
}

// Draw the future path and collision indicator
function drawFuturePath() {
  if (futurePath.length === 0) return;

  // Draw the future path
  ctx.beginPath();
  ctx.moveTo(futurePath[0].x, futurePath[0].y);
  for (let i = 1; i < futurePath.length; i++) {
    ctx.lineTo(futurePath[i].x, futurePath[i].y);
  }

  // Set path color based on collision speed
  if (collisionPoint) {
    if (collisionSpeed >= COLLISION_SPEED_THRESHOLD) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.6)"; // Red for high-speed collision
    } else {
      ctx.strokeStyle = "rgba(0, 255, 0, 0.6)"; // Green for low-speed collision
    }
  } else {
    ctx.strokeStyle = "rgba(255, 255, 0, 0.6)"; // Default yellow for no collision
  }

  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Draw collision indicator
  if (collisionPoint && particle.isActive) {
    if (collisionSpeed >= COLLISION_SPEED_THRESHOLD) {
      // Draw red "X" for high-speed collision
      ctx.fillStyle = "red";
      ctx.font = "20px Arial";
      ctx.fillText("💥", collisionPoint.x - 10, collisionPoint.y + 10);
      document.getElementById("collisionMainDivId").style.display =
        "flex";
    } else {
      // Draw green circle for low-speed collision

      ctx.fillStyle = "green";
      ctx.beginPath();
      ctx.arc(collisionPoint.x, collisionPoint.y, 4, 0, Math.PI * 2);
      ctx.fill();

      deleteCollisionWarningButton();
    }
  }
}

function deleteCollisionWarningButton() {
  document.getElementById("collisionMainDivId").style.display = "none";
}

/****************************************************
 * PART 8: MISSION TIMER
 ****************************************************/
class MissionTimer {
  constructor(displayElementId) {
    this.displayElement = document.getElementById(displayElementId);
    this.startTime = 0;
    this.elapsedTime = 0;
    this.running = false;
    this.intervalId = null;
  }

  start() {
    if (!this.running) {
      this.startTime = performance.now() - this.elapsedTime;
      this.running = true;
      this.updateDisplay();
    }
  }

  stop() {
    if (this.running) {
      this.elapsedTime = performance.now() - this.startTime;
      this.running = false;
    }
  }

  reset() {
    this.startTime = performance.now();
    this.elapsedTime = 0;
    this.running = true;
    this.updateDisplay();
  }

  getTime() {
    return this.running
      ? performance.now() - this.startTime
      : this.elapsedTime;
  }

  getFormattedTime() {
    let time = this.getTime();
    let milliseconds = Math.floor(time % 1000);
    let seconds = Math.floor((time / 1000) % 60);
    let minutes = Math.floor((time / (1000 * 60)) % 60);
    let hours = Math.floor(time / (1000 * 60 * 60));

    return (
      `${hours.toString().padStart(2, "0")}:` +
      `${minutes.toString().padStart(2, "0")}:` +
      `${seconds.toString().padStart(2, "0")} . ` +
      `${milliseconds.toString().padStart(3, "0")}`
    );
  }

  updateDisplay() {
    if (this.displayElement) {
      this.displayElement.textContent = this.getFormattedTime();
    }
  }
}

// Initialize the mission timer
const missionTimer = new MissionTimer("missionTimerId");

/// MISSION TIMER END ///

let currentVelocity = 0;



/****************************************************
 * PART 9: Framerate Displaying
 ****************************************************/
class FPSCounter {
constructor(displayElementId) {
  this.displayElement = document.getElementById(displayElementId);
  this.frames = [];
  this.lastFrameTimeStamp = performance.now();
}

trackFrame() {
  const now = performance.now();
  const delta = now - this.lastFrameTimeStamp;
  this.lastFrameTimeStamp = now;
  const fps = 1 / (delta / 1000);

  // Keep last 100 frame times
  this.frames.push(fps);
  if (this.frames.length > 100) {
      this.frames.shift();
  }

  // Calculate averaged FPS
  const avg = this.frames.reduce((total, fps) => total + fps) / this.frames.length;
  
  // Update display every 1 second
  if (!this.lastUpdate || now - this.lastUpdate > 25) {
      this.displayElement.textContent = Math.round(avg).toString().padStart(2, '0');
      this.lastUpdate = now;
  }
}
}
////////////Framerate Displaying END////////////





//Reset simulation
function resetParticle() {
    setTimeout(() => {
  particle.x = 100;
    particle.y = 100;
    particle.vx = 0;
    particle.vy = 0;
  
    particle.thrust.active = false;
    particle.thrust.timer = 0;
    particle.isActive = true;
    trace.length = 0;
    debris = [];
    futurePath = calculateFuturePath();
  
    setOxygenLevel(80);
    setFuelLevel(80);
    lastFuelUpdateTime = 0;
  
    if (missionTimer) {
      missionTimer.reset();
    }
  
    hideDisplayButton();
    },120);
   
  }
  


///Initializing FPS Displaying, needs to be initialized before update() function is called.
const fpsCounter = new FPSCounter("fpsCounterId");

function initSimulation(){
    update();
    resetParticle();
    futurePath = calculateFuturePath();
}

//INITIALIZE
initSimulation();
