import assert from "node:assert/strict";
import test from "node:test";
import { GTM_AGENT_CONTRACT, createGtmAgentRequest, prepareGtmAgentProposal, readGtmAgentContext, runGtmAgentTurn } from "../lib/gtm-agent-contract";
import { workspaceFingerprint } from "../lib/agent-session";
import { cleanContacts } from "../lib/operations";
import type { WorkspaceState } from "../lib/types";

const empty = (): WorkspaceState => ({ reminders: [], tasks: [], content: [], accounts: [], contacts: [], activities: [], opportunities: [], partnerships: [], projects: [], campaigns: [], marketingMetrics: [] });

test("GTM agent contract covers every workspace collection without a model or database", () => {
  assert.deepEqual([...GTM_AGENT_CONTRACT.collections].sort(), Object.keys(empty()).sort());
  assert.equal(GTM_AGENT_CONTRACT.savesRecords, false);
  assert.equal(GTM_AGENT_CONTRACT.approvalRequired, true);
  assert.equal(GTM_AGENT_CONTRACT.completionCollection, "tasks");
});

test("an existing agent can prepare coordinated GTM changes through an injected transport", async () => {
  const workspace = empty();
  let calls = 0;
  const proposal = await runGtmAgentTurn({ workspace, command: "Capture Acme and its content follow-up", history: [{role:"user",text:"The company is Acme."}] }, async (request) => {
    calls++;
    assert.equal(request.contractVersion, "1.4");
    assert.equal(request.history[0].text, "The company is Acme.");
    assert.equal(request.context.total, 0);
    return { reply:"Review the proposed records.", actions:[
      {type:"create",collection:"accounts",data:{name:"Acme"}},
      {type:"create",collection:"contacts",data:{name:"Sarah",accountName:"Acme",acquisitionMotion:"Referral"}},
      {type:"create",collection:"content",data:{title:"Adoption briefing",stage:"Idea"}},
      {type:"create",collection:"tasks",data:{title:"Outline briefing",relatedType:"content",relatedName:"Adoption briefing",due:"2026-09-02"}},
    ] };
  });
  assert.equal(calls,1);
  assert.equal(proposal.actions.length,4);
  assert.equal(proposal.nextWorkspace?.contacts[0].accountId,proposal.nextWorkspace?.accounts[0].id);
  assert.equal(proposal.nextWorkspace?.tasks[0].relatedId,proposal.nextWorkspace?.content[0].id);
  assert.equal(proposal.nextWorkspace?.tasks[0].visibility,"Private");
  assert.equal(proposal.baseWorkspaceVersion,await workspaceFingerprint(workspace));
  assert.deepEqual(workspace,empty());
  assert.equal(proposal.provider,undefined);
});

test("existing SOSA tools can prepare a proposal directly without the pilot prompt", async () => {
  const workspace = empty();
  const proposal = await prepareGtmAgentProposal(workspace,{reply:"Review this task.",actions:[{type:"create",collection:"tasks",data:{title:"Follow up",due:"2026-09-03"}}]});
  assert.equal(proposal.nextWorkspace?.tasks[0].title,"Follow up");
  assert.equal(workspace.tasks.length,0);
});

test("context carries honest coverage and full scoped deterministic totals", async () => {
  const workspace = empty();
  workspace.contacts=cleanContacts(Array.from({length:305},(_,i)=>({id:String(i),name:`Person ${i}`,createdAt:"2026-08-15T12:00:00Z"})));
  const context=await readGtmAgentContext(workspace,new Date(2026,7,20,12));
  assert.equal(context.currentDate,"2026-08-20");
  assert.equal(context.total,305);
  assert.equal(context.included,300);
  assert.equal(context.metricSummaries[0].period,"2026-08");
  assert.equal(context.metricSummaries[0].newPeople,305);
  assert.equal(context.metricSummaries.length,3);
});

test("a pending external-agent request cannot silently incorporate later source edits", async () => {
  const workspace=empty();
  const baseline=await workspaceFingerprint(workspace);
  const proposal=await runGtmAgentTurn({workspace,command:"Prepare a follow-up"},async()=>{
    workspace.tasks.push({id:"manual",title:"New manual work",description:"",due:"2026-09-01",priority:"High",recurrence:"One-time",done:false});
    return {actions:[{type:"create",collection:"tasks",data:{title:"Agent suggestion",due:"2026-09-02"}}]};
  });
  assert.equal(proposal.baseWorkspaceVersion,baseline);
  assert.notEqual(proposal.baseWorkspaceVersion,await workspaceFingerprint(workspace));
  assert.equal(proposal.nextWorkspace?.tasks.length,1);
  assert.equal(workspace.tasks[0].title,"New manual work");
});

test("clarification responses never include write previews", async () => {
  const proposal=await prepareGtmAgentProposal(empty(),{reply:"Which account?",needsClarification:true,actions:[{type:"create",collection:"accounts",data:{name:"Should not appear"}}]});
  assert.equal(proposal.actions.length,0);
  assert.equal(proposal.nextWorkspace,undefined);
});

test("partially valid external-agent batches fail closed rather than hiding dropped actions", async () => {
  const workspace=empty();
  await assert.rejects(prepareGtmAgentProposal(workspace,{actions:[
    {type:"create",collection:"tasks",data:{title:"Valid"}},
    {type:"delete",collection:"accounts",recordId:"missing"},
  ]}),/could not be prepared safely/);
  assert.deepEqual(workspace,empty());
});

test("malformed response envelopes are rejected before approval", async () => {
  for(const response of [null,[], "not JSON",{needsClarification:"true"},{actions:"save"}]) await assert.rejects(prepareGtmAgentProposal(empty(),response));
});

test("invalid commands never reach the injected agent", async () => {
  let called=false;
  await assert.rejects(runGtmAgentTurn({workspace:empty(),command:" "},async()=>{called=true;return {}; }),/Tell SOSA/);
  assert.equal(called,false);
});

test("shared request still gives the pilot its domain rules and bounded conversation", async () => {
  const request=await createGtmAgentRequest({workspace:empty(),command:"Plan a briefing",now:new Date(2026,7,20,12),history:[{role:"assistant",text:"For whom?",status:"proposed"},{role:"user",text:"CIOs"}]});
  assert.match(request.prompt,/Current local date: 2026-08-20/);
  assert.match(request.prompt,/CIOs/);
  assert.match(request.prompt,/Acquisition motion/);
  assert.match(request.prompt,/Workspace evidence \(0 of 0 active records/);
  assert.match(request.prompt,/Never write strategicValue/);
  assert.match(request.prompt,/Official deterministic opportunity recommendations/);
});

test("priority recommendations are calculated across the full workspace before evidence truncation", async () => {
  const workspace = empty();
  workspace.accounts.push({ id: "a1", name: "Example", type: "Prospect", status: "Active", owner: "Owner", website: "", notes: "", companySizeBand: "5,000+", createdAt: "2026-08-01T00:00:00Z" });
  workspace.opportunities = Array.from({ length: 305 }, (_, index) => ({
    id: `o${index}`, accountId: "a1", name: `Opportunity ${index}`, stage: "Qualify" as const, forecast: "Pipeline" as const,
    value: index === 304 ? 2_000_000 : 20_000, valueConfidence: "Validated" as const, annualRevenuePotential: index === 304 ? 1_000_000 : 0,
    strategicFit: index === 304 ? "High" as const : "Medium" as const, expansionPotential: index === 304 ? "High" as const : "Low" as const,
    seriousness: "Engaged" as const, decisionAccess: "Champion" as const, stakeholderCoverage: "Multi-threaded" as const,
    closeDate: "2026-12-01", owner: "Owner", nextSpejAction: "Confirm next step", nextCustomerDecision: "Confirm scope", nextActionDue: "2026-09-10",
    source: "Referral", notes: "", createdAt: "2026-08-01T00:00:00Z",
  }));
  const context = await readGtmAgentContext(workspace, new Date(2026, 8, 2, 12));
  assert.equal(context.prioritySummary.activeOpportunities, 305);
  assert.equal(context.priorityRecommendations.length, 100);
  assert.equal(context.priorityRecommendations[0].opportunityId, "o304");
});
