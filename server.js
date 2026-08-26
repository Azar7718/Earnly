const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname,'data.json');
if(!fs.existsSync(DATA)) fs.writeFileSync(DATA, JSON.stringify({
  users:[{id:'u1',name:'Demo User',email:'demo@earnly.test',password:'demo123',balance:0}],
  tasks:[
    {id:'t1',title:'Product feedback',description:'Share genuine feedback on a product experience.',reward:25},
    {id:'t2',title:'Content review',description:'Review a short piece of content.',reward:15},
    {id:'t3',title:'Survey',description:'Complete a clearly disclosed survey.',reward:30}
  ],
  withdrawals:[]
},null,2));

const read=()=>JSON.parse(fs.readFileSync(DATA));
const write=d=>fs.writeFileSync(DATA,JSON.stringify(d,null,2));
const sessions=new Map();

function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data));}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',x=>b+=x);req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}})})}
function auth(req){return sessions.get((req.headers.authorization||'').replace('Bearer ','')||'')}

const server=http.createServer(async(req,res)=>{
  if(req.method==='GET' && (req.url==='/' || req.url==='/index.html')){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return res.end(fs.readFileSync(path.join(__dirname,'public','index.html')));
  }
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization'});return res.end()}
  try{
    if(req.url==='/api/register' && req.method==='POST'){
      const b=await body(req), d=read();
      if(d.users.some(u=>u.email===b.email)) return send(res,409,{error:'Email already registered'});
      const u={id:crypto.randomUUID(),name:b.name,email:b.email,password:b.password,balance:0};
      d.users.push(u);write(d); const token=crypto.randomUUID();sessions.set(token,u.id);
      return send(res,200,{token,user:{id:u.id,name:u.name,email:u.email,balance:0}});
    }
    if(req.url==='/api/login' && req.method==='POST'){
      const b=await body(req),d=read(),u=d.users.find(x=>x.email===b.email&&x.password===b.password);
      if(!u)return send(res,401,{error:'Invalid login'});
      const token=crypto.randomUUID();sessions.set(token,u.id);
      return send(res,200,{token,user:{id:u.id,name:u.name,email:u.email,balance:u.balance}});
    }
    const uid=auth(req); if(!uid)return send(res,401,{error:'Login required'});
    const d=read(),u=d.users.find(x=>x.id===uid);
    if(req.url==='/api/me') return send(res,200,{user:{id:u.id,name:u.name,email:u.email,balance:u.balance}});
    if(req.url==='/api/tasks') return send(res,200,{tasks:d.tasks});
    if(req.url.startsWith('/api/tasks/') && req.method==='POST'){
      const id=req.url.split('/').pop(),t=d.tasks.find(x=>x.id===id);
      if(!t)return send(res,404,{error:'Task not found'});
      u.balance+=t.reward;write(d);return send(res,200,{ok:true,balance:u.balance,reward:t.reward});
    }
    if(req.url==='/api/withdraw' && req.method==='POST'){
      const b=await body(req), amount=Number(b.amount);
      if(!Number.isFinite(amount)||amount<=0||amount>u.balance)return send(res,400,{error:'Invalid amount'});
      d.withdrawals.push({id:crypto.randomUUID(),userId:u.id,amount,status:'pending',createdAt:new Date().toISOString()});
      write(d);return send(res,200,{ok:true,message:'Withdrawal request submitted for manual review.'});
    }
    return send(res,404,{error:'Not found'});
  }catch(e){send(res,500,{error:'Server error'})}
});
se server.listen(process.env.PORT || 3000, '0.0.0.0', ()=>console.log('Earnly server running'));
