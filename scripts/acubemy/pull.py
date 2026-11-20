import json,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import trpc
D=os.environ.get('ACUBEMY_DATA',os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),'data','acubemy')); N=1000
os.makedirs(f"{D}/raw",exist_ok=True)
def save(name,obj): json.dump(obj,open(f"{D}/raw/{name}.json","w"))
def data(r,what):
    if 'result' not in r: print("FAIL",what,json.dumps(r)[:300]); return None
    return r['result']['data']
os.chdir(D)
tok=trpc.auth()['idToken']; print("auth ok")
reads={"profile":("users.getProfile",None),"stats-averages":("users.averages",None),
"stats-averageMoveCount":("statistics.getAverageMoveCount",None),"stats-wrapped":("statistics.getWrapped",None),
"stats-trainingDueCount":("training.getDueCount",{"method":"CFOP"}),"stats-smartQueue":("training.getSmartQueue",{"method":"CFOP"}),
"customTrainings":("customTrainings.list",None),"tournaments-mine":("tournaments.getMyActiveTournaments",None),
"badges-catalog":("badges.getCatalog",None),"dailyScramble-dateRange":("dailyScramble.getDateRange",None)}
called=[]
for k,(p,i) in reads.items():
    d=data(trpc.query(tok,p,i),p); called.append(p)
    if d is not None: save(k,d)
snap=[];cur=None;scur=None;page=0
while True:
    inp={"cursor":cur,"protocol":1}
    if scur: inp["snapshotCursor"]=scur
    d=data(trpc.query(tok,"sync.pull",inp),"sync.pull")
    if d is None: sys.exit(1)
    j=d['json']; snap+=j['changes']; page+=1; print("pull page",page,len(j['changes']),j['hasMore'])
    if not j['hasMore']: break
    scur=j['snapshotCursor']
called.append("sync.pull")
solves=[c['data'] for c in snap if c['entity']=='solve' and c['op']=='upsert']
sessions=[c['data'] for c in snap if c['entity']=='session']
devices=[c['data'] for c in snap if c['entity']=='device']
save("sessions",sessions); save("devices",devices); save("sync-snapshot-user",[c for c in snap if c['entity']=='user'])
for s in sessions:
    d=data(trpc.query(tok,"statistics.getTPSInsights",{"analysisType":"CFOP","sessionUuid":s['uuid'],"limit":200}),"tps"); 
    if d is not None: save("stats-tpsInsights-"+s['uuid'][:8],d)
called.append("statistics.getTPSInsights")
solves.sort(key=lambda s:s['date'],reverse=True)
print("total solves",len(solves)); top=solves[:N]
out=[];metas=[]
for i in range(0,len(top),20):
    b=top[i:i+20]
    d=data(trpc.query(tok,"sync.getSolveDetails",{"uuids":[s['uuid'] for s in b]}),"details")
    if d is None: sys.exit(1)
    byid={x['uuid']:x for x in d['json']}
    metas.append(d.get('meta'))
    for s in b: out.append({"list":s,"detail":byid.get(s['uuid'])})
    print("detail",len(out),flush=True)
called.append("sync.getSolveDetails")
save("solves",out); save("detail-meta",metas)
r=trpc.query(tok,"export.downloadSolves",{"format":"json","range":{"type":"all"},"includeGyroData":True}); called.append("export.downloadSolves")
d=data(r,"export")
if d is not None:
    j=d['json']; save("export-all-meta",{k:v for k,v in j.items() if k!='fileContent'})
    open(f"{D}/raw/export-all.json","w").write(j['fileContent'])
open(f"{D}/called.txt","w").write("\n".join(called))
print("done")
