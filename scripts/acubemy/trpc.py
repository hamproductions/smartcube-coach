import json,os,time,urllib.request,urllib.error,urllib.parse
BASE="https://acubemy-backend-production-16644438767.europe-west1.run.app/trpc"
def auth():
    key=os.environ['ACUBEMY_FIREBASE_KEY']
    L=open(os.environ['ACUBEMY_CREDS']).read().split('\n')
    req=urllib.request.Request(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={key}",json.dumps({"email":L[0].strip(),"password":L[1].strip(),"returnSecureToken":True}).encode(),{"Content-Type":"application/json","Referer":"https://acubemy.com/"})
    return json.load(urllib.request.urlopen(req))
def query(token,proc,inp=None,meta=None,retries=3):
    item={"json":inp}
    if meta: item["meta"]=meta
    q=urllib.parse.quote(json.dumps({"0":item}) ,safe='')
    url=f"{BASE}/{proc}?batch=1&input={q}"
    h={"Authorization":"Bearer "+token,"x-acubemy-alg-sets":"OLL,PLL,F2L,CMLL,ZBLL","Origin":"https://acubemy.com","Referer":"https://acubemy.com/","User-Agent":"Mozilla/5.0"}
    for a in range(retries+1):
        try:
            time.sleep(0.2)
            r=urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=120)
            return json.load(r)[0]
        except urllib.error.HTTPError as e:
            body=e.read().decode()[:600]
            if e.code in(429,500,502,503,504) and a<retries: time.sleep(2**(a+1)); continue
            return {"httpError":e.code,"body":body}
