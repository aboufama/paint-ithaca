import { Watercolor } from './watercolor.js';

/** A device-local camera. Nothing is transmitted. Streams end on close/capture. */
export function createCamera({ onCapture }) {
  const dialog = document.getElementById('camera-dialog');
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-paint');
  const status = document.getElementById('camera-status');
  const message = document.getElementById('camera-message');
  const shutter = document.getElementById('camera-shutter');
  const flip = document.getElementById('camera-flip');
  const mode = document.getElementById('camera-mode');
  const amount = document.getElementById('camera-water');
  let stream, engine, raf = 0, generation = 0, facing = 'environment', painting = true, sample = false, active = false, lastFrame = 0, startedAt = 0;
  const sampleCanvas = document.createElement('canvas'); sampleCanvas.width = 960; sampleCanvas.height = 720;
  const sampleContext = sampleCanvas.getContext('2d'); let sampleImage;

  function stop() {
    active = false; generation++; cancelAnimationFrame(raf); raf = 0;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null; engine?.setPaused(true);
    shutter.disabled = true; flip.disabled = true;
  }
  function setMessage(title, body, busy = false) {
    message.hidden = false; message.querySelector('h3').textContent = title; message.querySelector('p').textContent = body;
    message.classList.toggle('busy', busy); document.getElementById('camera-enable').hidden = busy;
    document.getElementById('camera-sample').hidden = false;
  }
  function ensureEngine(source) {
    try {
      engine ||= new Watercolor(canvas); engine.setLiveSource(source); engine.setWater(Number(amount.value)/100); engine.setPaused(false); engine.setVisible(true);
    } catch {
      painting = false; mode.textContent = 'Original view'; mode.disabled = true; amount.disabled = true;
      document.getElementById('camera-effect-note').textContent = 'This browser supports original capture; watercolor needs WebGL2.';
    }
    applyMode();
  }
  function applyMode() {
    canvas.hidden = !painting || !engine;
    video.classList.toggle('camera-visible', !painting && !sample);
    sampleCanvas.classList.toggle('camera-visible', !painting && sample);
    mode.setAttribute('aria-pressed', String(painting)); mode.textContent = painting ? '✳ Watercolor' : '◉ Original';
    amount.disabled = !painting;
    engine?.setVisible(painting);
    status.textContent = sample ? 'SAMPLE CAMERA · CAYUGA LAKE' : 'LIVE · YOUR CAMERA';
  }
  function drawSample(now) {
    const t = (now-startedAt)/1000, scale = Math.max(960/sampleImage.width,720/sampleImage.height)*(1.08+.025*Math.sin(t*.3));
    const w=sampleImage.width*scale,h=sampleImage.height*scale;
    sampleContext.drawImage(sampleImage,(960-w)/2+Math.sin(t*.23)*18,(720-h)/2+Math.cos(t*.19)*9,w,h);
  }
  function frame(now) {
    if (!active) return;
    if (now-lastFrame>66) {
      if(sample)drawSample(now);
      if(painting)engine?.updateLiveSource(sample?sampleCanvas:video);
      lastFrame=now;
    }
    raf=requestAnimationFrame(frame);
  }
  function ready(source) {
    active=true; message.hidden=true; shutter.disabled=false; flip.disabled=sample;
    document.getElementById('camera-live-content').classList.add('ready');
    document.getElementById('camera-capture-label').textContent=sample?'Capture sample view':'Capture this view';
    ensureEngine(source); lastFrame=0;raf=requestAnimationFrame(frame);
  }
  async function startCamera() {
    stop(); const token=++generation; sample=false;
    document.getElementById('camera-live-content').classList.remove('ready');
    status.textContent='CONNECTING YOUR CAMERA';
    setMessage('Let’s see your Ithaca.', 'Allow camera access to turn the view in front of you into a living watercolor. Nothing leaves your device.', true);
    if(!navigator.mediaDevices?.getUserMedia){setMessage('Your camera isn’t available here.', 'Open the secure demo in a camera-enabled browser, or try the sample view.');status.textContent='CAMERA UNAVAILABLE';return;}
    try {
      const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:960}}});
      if(token!==generation||!dialog.open){next.getTracks().forEach(track=>track.stop());return;}
      stream=next;video.srcObject=stream;await video.play();
      if(token!==generation||!dialog.open){next.getTracks().forEach(track=>track.stop());return;}
      const track=stream.getVideoTracks()[0];
      track.addEventListener('ended',()=>{if(active&&!sample){stop();setMessage('The camera was disconnected.','Reconnect it and try again, or use a photo.');status.textContent='CAMERA DISCONNECTED';}},{once:true});
      video.classList.toggle('mirrored',track.getSettings().facingMode==='user');
      canvas.classList.toggle('mirrored',track.getSettings().facingMode==='user');
      ready(video);
    } catch(error) {
      if(token!==generation||!dialog.open)return;
      stop();status.textContent='CAMERA IS OFF';
      const errors={NotAllowedError:['Camera access is off.','Allow camera access in your browser, then try again. You can also choose a photo or try the sample.'],NotFoundError:['No camera found.','Connect a camera, open this on your phone, or try the sample view.'],NotReadableError:['Your camera is busy.','Close other apps using your camera, then try again.']};
      const [title,body]=errors[error.name]||['We couldn’t start the camera.','Please try again, choose a photo, or explore the sample view.'];setMessage(title,body);
    }
  }
  async function startSample() {
    stop(); const token=++generation; sample=true;status.textContent='LOADING SAMPLE CAMERA';
    try {
      if(!sampleImage){sampleImage=new Image();sampleImage.src='assets/cayuga-lake.jpg';await sampleImage.decode();}
      if(token!==generation||!dialog.open)return;
      startedAt=performance.now();drawSample(startedAt);canvas.classList.remove('mirrored');
      document.getElementById('camera-effect-note').textContent='Sample view for trying the camera. Use your camera to capture your own Ithaca.';
      ready(sampleCanvas);
    }catch{setMessage('The sample couldn’t load.','Please refresh and try again.');}
  }
  function capture() {
    if(!active)return;
    const raw=sample?sampleCanvas:video;
    const view=document.getElementById('camera-live-content');
    const aspect=view.clientWidth/view.clientHeight;
    const snapshot=(source)=>{
      const width=source.videoWidth||source.width,height=source.videoHeight||source.height;
      if(!width||!height)return null;
      const sw=Math.min(width,height*aspect),sh=sw/aspect;
      const photo=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(sw,sh));
      photo.width=Math.round(sw*scale);photo.height=Math.round(sh*scale);
      const ctx=photo.getContext('2d');
      if(canvas.classList.contains('mirrored')){ctx.translate(photo.width,0);ctx.scale(-1,1);}
      ctx.drawImage(source,(width-sw)/2,(height-sh)/2,sw,sh,0,0,photo.width,photo.height);
      return photo.toDataURL('image/jpeg',.9);
    };
    engine?.render();
    const originalImage=snapshot(raw),dataUrl=painting&&engine?snapshot(canvas):originalImage;
    if(!dataUrl)return;
    const result={dataUrl,originalImage,sample};
    document.getElementById('camera-flash').classList.add('flash');
    stop();dialog.close();onCapture(result);
  }
  sampleCanvas.id='camera-sample-preview';sampleCanvas.setAttribute('aria-hidden','true');document.getElementById('camera-live-content').prepend(sampleCanvas);
  document.getElementById('camera-enable').addEventListener('click',startCamera);
  document.getElementById('camera-sample').addEventListener('click',startSample);
  shutter.addEventListener('click',capture);
  flip.addEventListener('click',()=>{facing=facing==='environment'?'user':'environment';startCamera();});
  mode.addEventListener('click',()=>{painting=!painting;applyMode();if(painting&&active){engine?.setPaused(false);engine?.updateLiveSource(sample?sampleCanvas:video);}});
  amount.addEventListener('input',()=>{document.getElementById('camera-water-value').textContent=`${amount.value}%`;engine?.setWater(Number(amount.value)/100);});
  dialog.addEventListener('close',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open&&active){stop();setMessage('Camera paused while you were away.','Start it again whenever you’re ready.');status.textContent='CAMERA PAUSED';}});
  window.addEventListener('pagehide',()=>{stop();engine?.dispose();});
  return { open(){document.getElementById('camera-effect-note').textContent='Move your camera. Watch color flow, blend, and settle on paper.';document.getElementById('camera-flash').classList.remove('flash');stop(); dialog.showModal(); document.getElementById('camera-live-content').classList.remove('ready'); status.textContent='YOUR CAMERA, YOUR CANVAS'; setMessage('Let’s see your Ithaca.', 'Enable your camera to watch the view become watercolor in real time. Nothing leaves your device.');}, close(){dialog.close();} };
}
