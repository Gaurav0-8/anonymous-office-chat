/* Pre-seeded Protiviti Gantt data — extracted from Gantt Chart screenshots */
const INITIAL_DATA = [
  {
    id:'cat_admin', name:'Admin', color:'#4ade80',
    tasks:[
      {id:'t_a1', rowId:1, title:'Inventory Template Setup',               owner:'Arial/Aman',           startDate:'2026-04-25', duration:5,  progress:100, status:'Done'},
      {id:'t_a2', rowId:2, title:'Multiple Auditor Conflict Validation',   owner:'Aman/Ayesha/Shraddha', startDate:'2026-04-22', duration:3,  progress:100, status:'Done'},
      {id:'t_a3', rowId:3, title:'Allow/Reject Duplicate Serial Numbers',  owner:'Anjali/Ayesha',        startDate:'2026-04-26', duration:4,  progress:100, status:'Done'},
    ]
  },
  {
    id:'cat_auditor', name:'Auditor', color:'#f97316',
    tasks:[
      {id:'t_au1',  rowId:1,  title:'Manual Data Entry in Application',            owner:'Shraddha/Aman',        startDate:'2026-04-26', duration:3,  progress:0,   status:'Delayed'},
      {id:'t_au2',  rowId:2,  title:'Enable Barcode Scanning',                    owner:'Shraddha/Aman',        startDate:'2026-04-23', duration:7,  progress:100, status:'Done'},
      {id:'t_au3',  rowId:3,  title:'Hand held device integration',               owner:'Shraddha/Aman',        startDate:'2026-04-28', duration:5,  progress:50,  status:'Delayed'},
      {id:'t_au4',  rowId:4,  title:'Enable Image Upload',                        owner:'Shraddha/Aman',        startDate:'2026-05-01', duration:7,  progress:0,   status:'Delayed'},
      {id:'t_au5',  rowId:5,  title:'Enable Image Scanning (OCR)',                owner:'Shraddha/Aman',        startDate:'2026-05-03', duration:2,  progress:50,  status:'Delayed'},
      {id:'t_au6',  rowId:6,  title:'Fetch Expected Inventory Count (Barcode)',   owner:'Shraddha/Aman',        startDate:'2026-05-05', duration:6,  progress:100, status:'Done'},
      {id:'t_au7',  rowId:7,  title:'Flag Discrepancies (Damage)',                owner:'Shraddha/Aman',        startDate:'2026-05-07', duration:4,  progress:50,  status:'Delayed'},
      {id:'t_au8',  rowId:8,  title:'Flag Discrepancies (Expiry)',                owner:'Shraddha/Aman',        startDate:'2026-05-07', duration:3,  progress:50,  status:'Delayed'},
      {id:'t_au9',  rowId:9,  title:'Flag Discrepancies (Near Expiry)',           owner:'Shraddha/Aman',        startDate:'2026-05-10', duration:7,  progress:75,  status:'Delayed'},
      {id:'t_au10', rowId:10, title:'Perform Sample and 100% Audit',              owner:'Shraddha/Aman',        startDate:'2026-05-13', duration:3,  progress:0,   status:'Delayed'},
      {id:'t_au11', rowId:11, title:'Storage Location Selection Feature',         owner:'Shraddha/Aman',        startDate:'2026-05-15', duration:5,  progress:0,   status:'Delayed'},
      {id:'t_au12', rowId:12, title:'Handle Multi-Auditor Conflicts',             owner:'Aman/Ayesha/Shraddha', startDate:'2026-05-15', duration:5,  progress:75,  status:'Delayed'},
      {id:'t_au13', rowId:13, title:'Image Recognition (Auto Quantity Notation)', owner:'Aarushi Singh',        startDate:'2026-05-15', duration:2,  progress:50,  status:'Delayed'},
    ]
  },
  {
    id:'cat_critical', name:'Critical', color:'#ef4444',
    tasks:[
      {id:'t_c1', rowId:1, title:'High Priority Items', owner:'Low Priority', startDate:'2026-05-18', duration:2, progress:50, status:'Delayed'},
    ]
  },
  {
    id:'cat_not_started', name:'Not Started', color:'#6b7280',
    tasks:[
      {id:'t_ns1', rowId:1, title:'In Progress Tasks', owner:'Blocked', startDate:'2026-05-19', duration:6, progress:0, status:'Delayed'},
    ]
  },
  {
    id:'cat_pmo', name:'PMO', color:'#8b5cf6',
    tasks:[
      {id:'t_p1', rowId:1, title:'Monitor Live Audit Progress',                   owner:'Aman/Ayesha/Shraddha', startDate:'2026-05-22', duration:3, progress:0,   status:'Delayed'},
      {id:'t_p2', rowId:2, title:'Track Auditor-wise Progress (Multiple Stores)', owner:'Aman/Ayesha/Shraddha', startDate:'2026-05-22', duration:5, progress:100, status:'Done'},
    ]
  },
  {
    id:'cat_pmo_tl', name:'PMO/TL', color:'#a78bfa',
    tasks:[
      {id:'t_pt1', rowId:1, title:'Review Final Variance Report', owner:'Aman/Ayesha/Shraddha', startDate:'2026-05-22', duration:5, progress:50, status:'Delayed'},
      {id:'t_pt2', rowId:2, title:'PMO and TL QC Flow',           owner:'Aman/Ayesha/Shraddha', startDate:'2026-05-24', duration:2, progress:0,  status:'Delayed'},
    ]
  },
  {
    id:'cat_system', name:'System', color:'#06b6d4',
    tasks:[
      {id:'t_s1', rowId:1, title:'Send Email Notification',                owner:'Aman / Anjali',          startDate:'2026-05-27', duration:2, progress:25,  status:'Delayed'},
      {id:'t_s2', rowId:2, title:'Capture Inventory Data',                 owner:'Shraddha/Aman',           startDate:'2026-05-30', duration:2, progress:100, status:'Done'},
      {id:'t_s3', rowId:3, title:'Calculate Variance',                     owner:'Anjali/Aman',             startDate:'2026-06-01', duration:7, progress:50,  status:'Delayed'},
      {id:'t_s4', rowId:4, title:'Reconciliation Logic (Store → Master)',  owner:'Anjali/Ayesha/Aman',      startDate:'2026-06-01', duration:4, progress:50,  status:'In Progress'},
      {id:'t_s5', rowId:5, title:'Reconciliation Logic (Master → Store)',  owner:'Anjali/Ayesha/Shraddha',  startDate:'2026-06-01', duration:4, progress:50,  status:'In Progress'},
      {id:'t_s6', rowId:6, title:'Batch-Level Reconciliation Logic',       owner:'Anjali/Aman',             startDate:'2026-06-02', duration:3, progress:0,   status:'In Progress'},
      {id:'t_s7', rowId:7, title:'Location-Level Reconciliation Logic',    owner:'Aman',                    startDate:'2026-06-03', duration:7, progress:25,  status:'In Progress'},
    ]
  },
  {
    id:'cat_tl', name:'TL', color:'#f59e0b',
    tasks:[
      {id:'t_tl1',  rowId:1,  title:'Upload Audit Plan via Excel',        owner:'Anjali/Aman',        startDate:'2026-06-06', duration:6, progress:25,  status:'In Progress'},
      {id:'t_tl2',  rowId:2,  title:'Create Audit Plan Manually',         owner:'Anjali/Aman',        startDate:'2026-06-07', duration:5, progress:25,  status:'In Progress'},
      {id:'t_tl3',  rowId:3,  title:'Define Store Locations',             owner:'Aman/Shraddha',      startDate:'2026-06-07', duration:5, progress:100, status:'Done'},
      {id:'t_tl4',  rowId:4,  title:'Define Audit Timelines',             owner:'Anjali/Aman',        startDate:'2026-06-10', duration:6, progress:0,   status:'In Progress'},
      {id:'t_tl5',  rowId:5,  title:'Assign PMO',                         owner:'Anjali/Aman/Ayesha', startDate:'2026-06-12', duration:4, progress:100, status:'Done'},
      {id:'t_tl6',  rowId:6,  title:'Fetch Available Auditors',           owner:'Anjali/Aman/Ayesha', startDate:'2026-06-14', duration:6, progress:75,  status:'In Progress'},
      {id:'t_tl7',  rowId:7,  title:'Assign Auditors to Stores',          owner:'Anjali/Aman/Ayesha', startDate:'2026-06-16', duration:5, progress:25,  status:'In Progress'},
      {id:'t_tl8',  rowId:8,  title:'Bulk Upload Excel Stores',           owner:'Aman',               startDate:'2026-06-16', duration:5, progress:50,  status:'In Progress'},
      {id:'t_tl9',  rowId:9,  title:'Sample and 100% Audit Setup',        owner:'Anjali/Aman',        startDate:'2026-06-19', duration:5, progress:0,   status:'In Progress'},
      {id:'t_tl10', rowId:10, title:'Bulk Upload Multiple Stores Book S', owner:'Aman',               startDate:'2026-06-19', duration:2, progress:50,  status:'In Progress'},
    ]
  },
];
