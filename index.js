

let tsStart = -1;
let tsLast = Date.now();
let tickerId = 0;
const MIN_ACCELERATION = 12.0;
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
  if (samples.length < 9) {
    return -1;
  }

  for (let i = 9; i < samples.length; i++) {
    let floor = MIN_ACCELERATION < samples[i-9].value;

    let rise1 = samples[i-9].value < samples[i-8].value;
    let rise2 = samples[i-8].value < samples[i-7].value;

    let slow1 = samples[i-7].value > samples[i-6].value;
    let slow2 = samples[i-6].value > samples[i-5].value;

    let air1 = samples[i-4].value < samples[i-5].value;
    let air2 = samples[i-3].value < samples[i-5].value;
    let air3 = samples[i-2].value < samples[i-5].value;
    let air4 = samples[i-1].value < samples[i-5].value;
    let air5 = samples[i].value   < samples[i-5].value;

    if (!floor) {
      continue;
    }

    console.log('\n');
    console.log(`starting at ${i}`);
    console.log(`floor ${samples[i-9].value} ${floor ? '|' : 'x'}`);

    console.log(`rise1 ${samples[i-8].value} ${rise1 ? '\\' : '/'}`);
    console.log(`rise2 ${samples[i-7].value} ${rise2 ? ' \\' : '/'}`);

    console.log(`slow1 ${samples[i-6].value} ${slow1 ? ' /' : '\\'}`);
    console.log(`slow2 ${samples[i-5].value} ${slow2 ? '/' : '\\'}`);

    console.log(`air1  ${samples[i-4].value} ${air1 ? '|' : 'x'}`);
    console.log(`air2  ${samples[i-3].value} ${air2 ? '|' : 'x'}`);
    console.log(`air3  ${samples[i-2].value} ${air3 ? '|' : 'x'}`);
    console.log(`air4  ${samples[i-1].value} ${air4 ? '|' : 'x'}`);
    console.log(`air5  ${samples[i].value} ${air5 ? '|' : 'x'}`);

    if (
      MIN_ACCELERATION < samples[i-9].value
      // 3 points with increasing acceleration
      // (hand still pushing up to launch)
      && samples[i-9].value < samples[i-8].value
      && samples[i-8].value < samples[i-7].value

      // 3 points with decreasing acceleration
      // (phone acceleration slows after initial release)
      && samples[i-7].value > samples[i-6].value
      && samples[i-6].value > samples[i-5].value

      // 5 points below the min value (stable flight)
      && samples[i-4].value < samples[i-5].value
      && samples[i-3].value < samples[i-5].value
      && samples[i-2].value < samples[i-5].value
      && samples[i-1].value < samples[i-5].value
      && samples[i].value   < samples[i-5].value
    ) {
      return i-7;
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
        changeToDown(downAt);
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
  window.addEventListener('devicemotion', handleMotion);
  changeToLaunch();
}


function handleDebug() {
  changeToDebug();
}


function copyData() {
  navigator.clipboard.writeText(JSON.stringify(debug)).then(() => alert('copied'));
}


