

let tsStart = -1;
let tsLast = Date.now();
let tickerId = 0;
const MIN_ACCELERATION = 11.0;
const MIN_AIR_TIME = 1000;
// Check every 30ms
const INTERVAL = 30;
// Hold samples from the last ~900ms
const WINDOW_SIZE = 30;

const data = [];
const debug = [];


const MODES = {
  STANDBY: 'STANDBY',
  LAUNCH: 'LAUNCH',
  AIR: 'AIR',
  DOWN: 'DOWN',
  RELOAD: 'RELOAD',
  DEBUG: 'DEBUG',
};
let mode = MODES.STANDBY;


function changeToStandby() {
  mode = MODES.STANDBY;

  document.getElementById('standby').classList.remove('hide');

  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
  document.getElementById('debug').classList.add('hide');
}


function changeToLaunch() {
  mode = MODES.LAUNCH;

  document.getElementById('launch').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
  document.getElementById('debug').classList.add('hide');
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
  document.getElementById('debug').classList.add('hide');
}


function changeToDown(now, tooShort) {
  clearInterval(tickerId);
  mode = MODES.DOWN;

  window.removeEventListener('devicemotion', handleMotion);

  document.getElementById('down').classList.remove('hide');
  document.getElementById('time').innerText = `${(now - tsStart)}ms`;
  if (tooShort) {
    document.querySelectorAll('#down .jibe').forEach(node => node.classList.remove('hide'));
    document.querySelector('#down .try-again').classList.remove('hide');
  }

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('reload').classList.add('hide');
  document.getElementById('debug').classList.add('hide');
}


function changeToReload() {
  mode = MODES.AIR;

  window.removeEventListener('devicemotion', handleMotion);

  document.getElementById('reload').classList.remove('hide');

  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');
  document.getElementById('debug').classList.add('hide');
}


function changeToDebug() {
  mode = MODES.DEBUG;

  window.removeEventListener('devicemotion', handleMotion);

  document.getElementById('debug').classList.remove('hide');

  document.getElementById('reload').classList.add('hide');
  document.getElementById('standby').classList.add('hide');
  document.getElementById('launch').classList.add('hide');
  document.getElementById('air').classList.add('hide');
  document.getElementById('down').classList.add('hide');

  debug.forEach(({ ts, value}) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${ts}</td>
      <td>${value}</td>
    `;

    const table = document.querySelector('#debug .messages');
    if (table) {
      table.appendChild(row);
    }
  });
}


function getAirStartIndex(samples) {
  if (samples.length < WINDOW_SIZE) {
    return -1;
  }

  // Try to enforce a minimum of ~300ms air time.
  const MIN_RISE_SAMPLES = 10;

  let riseCount = 0;
  let releaseIndex = -1;
  let maxAcceleration = samples[0].value;

  for (let i = 1; i < samples.length; i++) {
    const slowing = samples[i].value < samples[i-1].value;

    if (slowing) {
      riseCount++;
    } else {
      releaseIndex = i;
      riseCount = 0;
      maxAcceleration = Math.max(maxAcceleration, samples[i].value);
    }

    if (MIN_RISE_SAMPLES <= riseCount && MIN_ACCELERATION < maxAcceleration) {
      return releaseIndex;
    }
  }

  return -1;
}


function getDownIndex(samples) {
  // Allow for some jitter in values from the accelerometer.
  const DECEL_THRESHOLD = 11.0;
  const DOWN_THRESHOLD = 9.0;
  const MIN_DOWN_POINTS = 10;
  let isRising = true;
  let downCount = 0;

  for (let i = 1; i < samples.length; i++) {
    if (isRising) {
      // We know the phone is in free fall when a sample value is below this threshold.
      if (samples[i].value <= DECEL_THRESHOLD) {
        debug.push({
          ts: samples[i].ts,
          value: `falling at ${samples[i].ts}`,
        });
        isRising = false;
      }
      // else - Phone is still rising toward its apex (acceleration continues decrease to ~9.8).
    } else {
      if (DECEL_THRESHOLD < samples[i].value) {
        // We're done if there is a sharp deceleration after free fall.
        // Don't bother counting low-accel samples.
        return i;
      } else if (samples[i].value < DOWN_THRESHOLD) {
        downCount++;
      } else {
        downCount = 0;
      }
    }

    if (MIN_DOWN_POINTS <= downCount) {
      //return samples[i-downCount].ts;
      return i - downCount;
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

  processDatapoint({
    ts: now,
    value: Number(magnitude.toFixed(4)),
  });
}


function processDatapoint(datum) {
  data.push(datum);
  debug.push(datum);

  if (WINDOW_SIZE < data.length) {
    // Drop the oldest datapoint
    data.shift();

    if (mode === MODES.LAUNCH && WINDOW_SIZE <= data.length) {
      const airStartIndex = getAirStartIndex(data);
      if (airStartIndex !== -1) {
        const airStartAt = data[airStartIndex].ts;
        debug.push({
          ts: datum.ts,
          value: `airStartAt ${airStartAt}`,
        });
        // Drop datapoints from before and during launch.
        data.splice(0, airStartIndex);
        changeToAir(airStartAt);
      }
    } else if (mode === MODES.AIR && WINDOW_SIZE <= data.length) {
      const downAtIndex = getDownIndex(data);
      if (downAtIndex !== -1 && downAtIndex < data.length) {
        const downAt = data[downAtIndex].ts;
        debug.push({
          ts: datum.ts,
          value: `downAt ${downAt}`,
        });
        const tooShort = (downAt - tsStart) < MIN_AIR_TIME;
        if (tooShort) {
          debug.push({
            ts: datum.ts,
            value: `air too short: ${(downAt - tsStart)}`,
          });
        }
        changeToDown(downAt, tooShort);
      } else if (data.length <= downAtIndex) {
          debug.push({
            ts: datum.ts,
            value: `data (${data.length}) < downAtIndex ${downAtIndex}`,
          });
          changeToReload();
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


function reset() {
  tsStart = -1;
  tsLast = Date.now();
  data.splice(0, data.length);
  debug.splice(0, debug.length);
  changeToLaunch();
}


function handleDebug() {
  changeToDebug();
}


function copyData() {
  navigator.clipboard.writeText(JSON.stringify(debug)).then(() => alert('copied'));
}


