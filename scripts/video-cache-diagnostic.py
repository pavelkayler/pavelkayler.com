#!/usr/bin/env python3
"""Compare the same production MP4 through HTTP and Blob, without the application."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'test-results/browser/video-diagnostic'
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_GET(self):
        if self.path=='/probe.html':
            data=b'<!doctype html><meta name="viewport" content="width=device-width"><body></body>'
            self.send_response(200); self.send_header('Content-Type','text/html'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
        else:
            try: super().do_GET()
            except (BrokenPipeError,ConnectionResetError): pass

async def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'dist')))
    thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
    base=f'http://127.0.0.1:{server.server_port}'
    results=[]
    try:
        async with async_playwright() as p:
            for engine,name in ((p.chromium,'chromium'),(p.webkit,'webkit')):
                browser=await engine.launch()
                try:
                    context=await browser.new_context(viewport={'width':414,'height':896},is_mobile=True,has_touch=True)
                    page=await context.new_page()
                    failures=[]
                    page.on('requestfailed',lambda request: failures.append({'url':request.url,'reason':request.failure}))
                    await page.goto(base+'/probe.html')
                    for file in ('portraits-cover.mp4','projects-cover.mp4'):
                        for mode in ('http','response-blob','typed-blob'):
                            record=await page.evaluate('''async ({file,mode})=>{
                              const video=document.createElement('video');
                              video.muted=true;video.playsInline=true;video.autoplay=true;video.preload='auto';
                              video.style.cssText='width:320px;height:240px';
                              document.body.append(video);
                              const events=[];for(const event of ['loadedmetadata','loadeddata','canplay','error','stalled','suspend']) video.addEventListener(event,()=>events.push(event));
                              const result={file,mode,mp4:video.canPlayType('video/mp4'),avc:video.canPlayType('video/mp4; codecs="avc1.640028"')};
                              let url='/media/video/'+file;
                              if(mode!=='http'){
                                const response=await fetch(url);const blob=await response.blob();
                                result.response={status:response.status,type:blob.type,size:blob.size};
                                url=URL.createObjectURL(mode==='typed-blob'?new Blob([blob],{type:'video/mp4'}):blob);
                                const first=await fetch(url,{headers:{Range:'bytes=0-15'}});
                                const bytes=new Uint8Array(await first.arrayBuffer());
                                result.blobProbe={status:first.status,bytes:Array.from(bytes.slice(0,16)),length:bytes.length};
                              }
                              video.src=url;
                              let playError='';void video.play().catch(e=>playError=String(e));
                              const until=performance.now()+8000;
                              while(performance.now()<until && video.readyState<2 && !video.error) await new Promise(r=>setTimeout(r,100));
                              await new Promise(r=>setTimeout(r,300));
                              Object.assign(result,{src:video.currentSrc,readyState:video.readyState,networkState:video.networkState,error:video.error?{code:video.error.code,message:video.error.message}:null,events,playError,width:video.videoWidth,height:video.videoHeight,time:video.currentTime});
                              video.pause();video.removeAttribute('src');video.load();video.remove();
                              if(mode!=='http')URL.revokeObjectURL(url);
                              return result;
                            }''',{'file':file,'mode':mode})
                            record['engine']=name;results.append(record);print(json.dumps(record),flush=True)
                    results.append({'engine':name,'request_failures':failures})
                    await context.close()
                finally: await browser.close()
    finally:
        server.shutdown();server.server_close();thread.join(timeout=2)
    (OUTPUT/'report.json').write_text(json.dumps(results,indent=2))
if __name__=='__main__': asyncio.run(main())
