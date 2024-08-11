

let tsStart = -1;
let tsLast = Date.now();
let tickerId = 0;
const MIN_ACCELERATION = 19.0;
// Check every 30ms
const INTERVAL = 30;
// Hold samples from the last ~900ms
const WINDOW_SIZE = 30;

const data = [];


const MODES = {
  STANDBY: 'STANDBY',
  LAUNCH: 'LAUNCH',
  AIR: 'AIR',
  DOWN: 'DOWN',
  RELOAD: 'RELOAD',
};
let mode = MODES.STANDBY;


function changeToStandby() {
  mode = MODES.STANDBY;

  document.getElementById('standby').classList.remove('hide');

  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToLaunch() {
  mode = MODES.LAUNCH;

  document.getElementById('launch').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToAir(now) {
  mode = MODES.AIR;

  tsStart = now;

  tickerId = window.setInterval(
    () => document.getElementById('ticker').innerText = (Date.now() - tsStart),
    50
  );

  document.getElementById('air').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToDown(now) {
  clearInterval(tickerId);
  mode = MODES.DOWN;

  window.removeEventListener('devicemotion', handleMotion);

  document.getElementById('down').classList.remove('hide');
  document.getElementById('time').innerText = `${(now - tsStart)}ms`;

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
}


function changeToReload() {
  mode = MODES.AIR;

  window.removeEventListener('devicemotion', handleMotion);

  document.getElementById('reload').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
}


function getAirStartIndex(samples) {
  if (samples.length < WINDOW_SIZE) {
    return -1;
  }

  const MIN_BOOST = 1.0;
  const MIN_BOOST_SAMPLES = 3;
  // Try to enforce a minimum of ~500ms in the air.
  const MIN_AIR_SAMPLES = 16;

  let boostCount = 0;
  let flyingCount = 0;
  let isBoosting = true;
  let delta = 0.0;
  let peakAcceleration = 0.0;

  for (let i = 1; i < samples.length; i++) {
    delta = samples[i].value - samples[i-1].value;

    if (isBoosting) {
      if (0.0 < delta) {
        boostCount++;
        peakAcceleration = Math.max(peakAcceleration, samples[i].value);
      } else {
        flyingCount++;
        isBoosting = false;
      }
    } else {
      // We expect boost (acceleration) to decline after the phone is in the air.
      // Allow a fair amount of jitter here by accepting acceleration values up to 11.0 m/s^2.
      if (delta < 0 || samples[i].value < 11.0) {
        flyingCount++;
      } else if (MIN_BOOST < delta) {
        isBoosting = true;
        peakAcceleration = Math.max(peakAcceleration, samples[i].value);
        boostCount = 1;
        flyingCount = 0;
      }
    }

    if (MIN_BOOST_SAMPLES <= boostCount
        && MIN_AIR_SAMPLES <= flyingCount
        && MIN_ACCELERATION < peakAcceleration
    ) {
      return i - flyingCount;
    }
  }

  return -1;
}


function getDownTimestamp(samples) {
  // TODO - lots of work to be done in here 

  const DECEL_THRESHOLD = 11.0;
  const DOWN_THRESHOLD = 9.8;
  const MIN_DOWN_POINTS = 10;

  let downCount = 0;

  for (let i = 1; i < samples.length; i++) {
    if (DECEL_THRESHOLD <= samples[i].value) {
      // If there is a sharp deceleration, we're done.
      // Don't bother counting low-accel samples.
      return samples[i].ts;
    } else if (samples[i].value < DOWN_THRESHOLD) {
      downCount++;
    } else {
      downCount = 0;
    }

    if (MIN_DOWN_POINTS <= downCount) {
      return samples[i-downCount].ts;
    }
  }

  return -1;
}


function handleMotion(ev) {
  if (mode !== MODES.STANDBY
    && mode !== MODES.LAUNCH
    && mode !== MODES.AIR
  ) {
    return;
  }

  const now = Date.now();
  if ((now - tsLast) < INTERVAL) {
    return;
  }
  tsLast = now;

  const { x, y, z } = ev.acceleration;
  const magnitude = Math.sqrt( (x * x) + (y * y) + (z * z) );

  data.push({
    ts: now,
    value: Number(magnitude.toFixed(4)),
  });

  if (WINDOW_SIZE < data.length) {
    // Drop the oldest datapoint
    data.shift();

    if (mode === MODES.LAUNCH && WINDOW_SIZE <= data.length) {
      const airStartIndex = getAirStartIndex(data);
      if (airStartIndex !== -1) {
        const airStartAt = data[airStartIndex].ts;
        // Drop datapoints from before and during launch.
        data.splice(0, airStartIndex);
        changeToAir(airStartAt);
      }
    } else if (mode === MODES.AIR && WINDOW_SIZE <= data.length) {
      const downAt = getDownTimestamp(data);
      if (downAt !== -1) {
        changeToDown(downAt);
      }
    }
  }
}


function init() {

  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(response => {
      if (response == 'granted') {
        window.addEventListener('devicemotion', handleMotion);
        changeToLaunch();
      } else {
        changeToReload();
      }
    });
  } else {
    window.addEventListener('devicemotion', handleMotion);
    changeToLaunch();
  }
}


