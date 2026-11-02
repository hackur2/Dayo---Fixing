import assert from "node:assert/strict";
import { after,test } from "node:test";
import { createServer } from "vite";
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:"custom"});
const {createCloudSyncService}=await vite.ssrLoadModule('/src/services/cloudSyncService.js');
after(()=>vite.close());
const id='11111111-1111-4111-8111-111111111111';
const status={pending_count:8,failed_count:0,skipped_count:0,worker_available:true,last_successful_sync_at:null,run:null};

test("the dashboard requests only protected local RPCs and reads persisted run counts",async()=>{
  const calls=[];
  const service=createCloudSyncService({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='request_cloud_sync'?id:status,error:null};}});
  assert.deepEqual(await service.getStatus(),status);
  assert.equal(await service.requestSync(),id);
  await service.getStatus(id);
  assert.deepEqual(calls,[{name:'get_cloud_sync_status',args:{p_run_id:null}},{name:'request_cloud_sync',args:undefined},{name:'get_cloud_sync_status',args:{p_run_id:id}}]);
});
test("missing setup, permissions, and network failures cannot be reported as successful or empty syncs",async()=>{
  for(const [code,pattern] of [['PGRST202',/setup/],['42501',/Super Admin/],['55000',/unavailable/]]){
    const service=createCloudSyncService({rpc:async()=>({error:{code,message:'private server details'}})});
    await assert.rejects(service.requestSync(),pattern);await assert.rejects(service.getStatus(),pattern);
  }
  const offline=createCloudSyncService({rpc:async()=>{throw new TypeError('fetch failed');}});
  await assert.rejects(offline.getStatus(),/remain saved/);
  await assert.rejects(createCloudSyncService(null).requestSync(),/remain saved/);
});
test("malformed confirmations and partial status results are rejected",async()=>{
  for(const data of [null,{}, {...status,pending_count:-1},{...status,run:{id,status:'succeeded'}},{...status,last_successful_sync_at:'invalid'}]) {
    await assert.rejects(createCloudSyncService({rpc:async()=>({data,error:null})}).getStatus(),/remain saved/);
  }
  await assert.rejects(createCloudSyncService({rpc:async()=>({data:{status:'ok'},error:null})}).requestSync(),/remain saved/);
});
