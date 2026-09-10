import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'
const source = await readFile(new URL('../public/video-cache-worker.js', import.meta.url), 'utf8')
const url = 'https://portfolio.test/media/video/projects-cover.mp4?portfolio-video=release-1'
function worker() {
  const events = new Map()
  const bytes = Uint8Array.from({length: 100}, (_, i) => i)
  const stored = new Response(bytes, {headers: {'Content-Type':'video/mp4','Content-Length':'100'}})
  runInNewContext(source, {URL, Headers, Response, Request, Number,
    self: {registration:{scope:'https://portfolio.test/'},location:{origin:'https://portfolio.test'},
      addEventListener:(name, fn)=>events.set(name,fn)},
    caches: {open:async()=>({match:async()=>stored.clone()})},
    fetch:()=>{throw new Error('Unexpected origin request')},
  })
  return async (headers={}, method='GET', resource=url) => {
    let result
    events.get('fetch')({request:new Request(resource,{method,headers}),respondWith:value=>{result=value}})
    return result
  }
}
test('complete cached video, head and all common single byte ranges', async () => {
  const get = worker()
  const full = await get()
  assert.equal(full.status,200);assert.equal((await full.arrayBuffer()).byteLength,100)
  for (const [range,first,last] of [['bytes=0-1',0,1],['bytes=80-',80,99],['bytes=-10',90,99],['bytes=95-200',95,99]]) {
    const response=await get({Range:range})
    assert.equal(response.status,206)
    assert.equal(response.headers.get('Content-Range'),`bytes ${first}-${last}/100`)
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],Array.from({length:last-first+1},(_,i)=>i+first))
  }
  const head=await get({},'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'')
})
test('invalid or unsatisfied ranges never fetch or return corrupt slices',async()=>{
  const get=worker()
  for(const Range of ['bytes=100-','bytes=30-20','bytes=','bytes=0-1,5-7','bytes=-0']) {
    const response=await get({Range});assert.equal(response.status,416)
    assert.equal(response.headers.get('Content-Range'),'bytes */100')
  }
  const response=await get({Range:'bytes=0-1','If-Range':'"unknown-version"'})
  assert.equal(response.status,200)
})
test('worker leaves documents, code, photos and ordinary video URLs untouched',async()=>{
  const get=worker()
  for(const path of ['/', '/_app/release-1/site.js','/media/images/home/photo.jpg','/media/video/projects-cover.mp4'])
    assert.equal(await get({},'GET','https://portfolio.test'+path),undefined)
})
