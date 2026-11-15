/* 练习场的页面内探针（被 _dev/shot-practice.js 塞进 CODEATLAS_SHOT_JS 执行）。
   注意：这段代码是在渲染进程里跑的，不是 Node —— 不能用 require，
   要断言就得把结果 return 出来，主进程会把它写进 [shot] js => 日志行。 */
(async function () {
  const out = { ok: [], bad: [] };
  const P = window.PRACTICE;
  const eq = (name, got, want) => {
    if (String(got) === String(want)) out.ok.push(name);
    else out.bad.push(name + ' → 实际 ' + JSON.stringify(got) + '，期望 ' + JSON.stringify(want));
  };
  const has = (name, hay, needle) => {
    if (String(hay).indexOf(needle) > -1) out.ok.push(name);
    else out.bad.push(name + ' → 没找到 ' + JSON.stringify(needle));
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  P.open();
  await wait(120);
  /* 上一次跑留下的设备名/配置会存在 localStorage 里（这是设计如此），
     断言要可重复，所以先恢复出厂 */
  P.reset();
  eq('面板已打开', document.getElementById('practice').classList.contains('on'), 'true');

  /* ---------- 1. 视图 / 提示符 ---------- */
  P.exec('system-view');
  eq('进系统视图', P._st.view, 'system');
  eq('提示符变 [Huawei]', document.querySelector('#prPrompt').textContent, '[Huawei]');

  P.exec('sysname SW1');
  eq('sysname 改设备名', P._st.sysname, 'SW1');
  eq('提示符跟着改名', document.querySelector('#prPrompt').textContent, '[SW1]');

  /* 缩写 + 带空格的接口名（VRP 合法写法） */
  P.exec('int g 0/0/1');
  eq('缩写 int g 0/0/1 进接口视图', P._st.view, 'if');
  eq('接口视图提示符', document.querySelector('#prPrompt').textContent, '[SW1-GigabitEthernet0/0/1]');

  P.exec('port link-type access');
  P.exec('port default vlan 10');
  P.exec('quit');
  P.exec('vlan batch 10 20');
  eq('quit 回到系统视图', P._st.view, 'system');

  /* ---------- 2. 配置记忆 ---------- */
  P.exec('interface Vlanif10');
  P.exec('ip address 192.168.1.254 255.255.255.0');
  P.exec('quit');
  const cfg = P._config();
  has('current-configuration 有 sysname', cfg, 'sysname SW1');
  has('current-configuration 有接口块', cfg, 'interface GigabitEthernet0/0/1');
  has('接口块里的子命令带缩进', cfg, ' port link-type access');
  has('VLANIF 地址进了配置', cfg, 'ip address 192.168.1.254 255.255.255.0');
  has('结尾有 return', cfg, 'return');

  /* undo 真的删掉，不是当没发生 */
  P.exec('undo vlan batch 10 20');
  const cfg2 = P._config();
  eq('undo 后 vlan batch 没了', cfg2.indexOf('vlan batch'), -1);

  /* ---------- 3. 报错：掩码写成反掩码 ---------- */
  P.exec('system-view');
  P.exec('ip route-static 10.0.0.0 0.0.0.255 192.168.1.1');
  const scr = document.querySelector('#prScreen').textContent;
  has('报错文案跟真机一样', scr, "Wrong parameter found at '^' position.");
  has('报错下面给中文原因', scr, '是反掩码');
  has('还给出正确写法', scr, '255.255.255.0');

  /* ---------- 3.5 MPLS：mpls ldp 的父视图是 mpls，不是 system ----------
     v1.2.0 这里挂错了父视图，导致走 MPLS 的剧本第一条就报错。
     真机的顺序是 system-view → mpls → mpls ldp，三步都不能省。 */
  P.reset();
  P.exec('system-view');
  P.exec('mpls lsr-id 1.1.1.1');
  P.exec('mpls');
  eq('mpls 进 MPLS 视图', P._st.view, 'mpls');
  const rLdp = P.exec('mpls ldp');
  eq('MPLS 视图下 mpls ldp 不报错', !(rLdp && rLdp.err), 'true');
  eq('进了 MPLS LDP 视图', P._st.view, 'mplsLdp');
  has('提示符变成 mpls-ldp', document.querySelector('#prPrompt').textContent, 'mpls-ldp');
  /* 真机在系统视图里敲 mpls ldp 就是错的，模拟器不能当好话听 */
  eq('系统视图下 mpls ldp 照样报错', !!window.VRP.analyze('system', 'mpls ldp').err, 'true');

  /* ---------- 3.6 报错分两档：真敲错 vs 模拟器没收录 ---------- */
  P.reset();
  P.exec('system-view');
  P.exec('xyz abc');
  has('首词不认 → 直说没这条命令',
    document.querySelector('#prScreen').textContent, '这个视图下没有这条命令');
  P.exec('interface GigabitEthernet0/0/1');
  P.exec('ospf bfd enable');
  has('认到一半 → 说明是模拟器没收录',
    document.querySelector('#prScreen').textContent, '模拟器只收录到这一层');

  /* ---------- 3.7 自动敲：敲不通的剧本不许演 ----------
     演示里冒出红色报错，用户会以为是自己敲错了。所以先预检，
     卡在哪一步就直说，并且一条都不勾。 */
  P.reset();
  P.load([{ c: 'system-view' }, { c: 'mpls ldp' }, { c: 'quit' }], '故意写错的剧本');
  document.getElementById('prDemo').click();
  const scrDemo = document.querySelector('#prScreen').textContent;
  has('预检拦住敲不通的剧本', scrDemo, '自动敲没开始');
  has('预检指出卡在哪一步', scrDemo, 'mpls ldp');
  eq('队列一条都没被勾掉', (P._st.queue.steps.filter(x => x.done) || []).length, '0');
  P.reset();

  /* ---------- 4. 路由表从配置推出来 ---------- */
  /* 上面几段测试把设备恢复过出厂，这里自己把前置条件配回来 ——
     别依赖别的测试段留下的状态，否则一动就全红。 */
  P.reset();
  P.exec('system-view');
  P.exec('interface Vlanif10');
  P.exec('ip address 192.168.1.254 255.255.255.0');
  P.exec('quit');
  P.exec('ip route-static 10.0.0.0 255.255.255.0 192.168.1.1');
  P.exec('display ip routing-table');
  const rt = document.querySelector('#prScreen').textContent;
  has('路由表有直连', rt, '192.168.1.0/24');
  has('路由表有静态', rt, '10.0.0.0/24');
  has('静态路由 proto 对', rt, 'Static');

  /* 协议表项不许编 */
  P.exec('display ospf peer');
  has('OSPF 邻居不编假数据', document.querySelector('#prScreen').textContent, '不模拟');

  /* ---------- 5. Tab 补全 / ? ---------- */
  P.reset();            /* 回用户视图：system-view 只在 user 视图里能补全 */
  const inp = document.getElementById('prCmd');
  inp.value = 'sys';
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  eq('Tab 补齐 system-view', inp.value, 'system-view');

  inp.value = '';
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
  const candOn = document.querySelector('#prCands').classList.contains('on');
  const candN = document.querySelectorAll('#prCands .cg').length;
  eq('? 弹出候选', candOn, 'true');
  if (candN > 0) out.ok.push('候选有 ' + candN + ' 条'); else out.bad.push('候选是空的');
  inp.value = '';
  document.querySelector('#prCands').classList.remove('on');

  /* ---------- 6. 命令库（懒加载 dict.js） ---------- */
  document.getElementById('prLibQ').value = 'ospf cost';
  document.getElementById('prLibQ').dispatchEvent(new Event('input', { bubbles: true }));
  for (let i = 0; i < 60 && !window.VRP_DICT; i++) await wait(100);
  const loaded = !!window.VRP_DICT;
  eq('命令库已加载', loaded, 'true');
  if (loaded) {
    out.ok.push('命令库条数 ' + window.VRP_DICT.n + '（可演练 ' + window.VRP_DICT.sim + '）');
    const items = document.querySelectorAll('#prLibList .pr-item').length;
    if (items > 0) {
      document.querySelector('#prLibList .pr-item').click();
      await wait(60);
      const d = document.querySelector('#prDetail').textContent;
      if (d.length > 20) out.ok.push('点命令出详情'); else out.bad.push('详情是空的');
      const btn = document.querySelector('#prDetail [data-liact]');
      if (btn) out.ok.push('详情有操作按钮'); else out.bad.push('详情没有按钮');
    } else out.bad.push('搜 ospf cost 没有结果');
  }

  /* ---------- 7. 演练队列 ---------- */
  P.reset();            /* 回用户视图，下面要敲 system-view 才能对上第一条 */
  const rec = (window.CODEATLAS.recipes || [])[0];
  if (rec) {
    P.load(rec.steps.map(s => ({ c: s.c, note: s.note })), rec.title);
    const steps = document.querySelectorAll('#prQList .pr-step').length;
    if (steps === rec.steps.length) out.ok.push('队列装入 ' + steps + ' 步');
    else out.bad.push('队列步数不对：' + steps + ' vs ' + rec.steps.length);
    P.exec('system-view');
    const done = document.querySelectorAll('#prQList .pr-step.done').length;
    if (done >= 1) out.ok.push('敲对一步自动勾选'); else out.bad.push('敲对了没勾');
  } else out.bad.push('没有剧本数据');

  /* ---------- 8. 从剧本 / 预设页点「演练」的接线 ---------- */
  const API = window.CodeAtlas;         // 逻辑层导出的接口（window.CodeAtlas）
  const DATA = window.CODEATLAS;        // 内容数据（window.CODEATLAS）——两个别搞混
  if (API && API.practiceSteps) {
    const recId = (DATA.recipes || [])[0];
    const packR = recId ? API.practiceSteps('recipe:' + recId.id) : null;
    if (packR && packR.steps.length) out.ok.push('剧本能翻成演练步骤（' + packR.steps.length + ' 步）');
    else out.bad.push('剧本翻不出演练步骤');
    const pset = (DATA.presets || []).find(x => x.task);
    const packP = pset ? API.practiceSteps('preset:' + pset.id) : null;
    if (!pset) out.ok.push('（没有任务型预设，跳过）');
    else if (packP && packP.steps.length) out.ok.push('任务型预设能翻成演练步骤（' + packP.steps.length + ' 步）');
    else out.bad.push('任务型预设翻不出演练步骤');
    /* 真的点一下那个按钮，确认事件接线通 */
    const fake = document.createElement('button');
    fake.setAttribute('data-act', 'practice-run');
    fake.setAttribute('data-pre', 'recipe:' + (recId ? recId.id : ''));
    document.body.appendChild(fake);
    fake.click();
    fake.remove();
    const qTitle = document.querySelector('#prQList .pr-qempty b');
    if (qTitle && qTitle.textContent === recId.title) out.ok.push('点「演练」按钮真的装进队列');
    else out.bad.push('点「演练」没装进队列');
  } else out.bad.push('没有 practiceSteps 接口');

  /* 收尾：把界面摆成好看的样子拍照。
     皮肤只改这一次渲染（save=false），不动用户存的偏好。 */
  try { window.CodeAtlas.applySkin('void', false, false); } catch (e) {}
  P.reset();
  document.querySelector('#prScreen').innerHTML = '';   // 前面几十行断言的回显别留在图上
  /* 收尾这几步就是照着演练队列敲的，截图里队列的勾和终端里的命令对得上 */
  if (rec) {
    P.load(rec.steps.map(x => ({ c: x.c, note: x.note })), rec.title);
    rec.steps.slice(0, 6).forEach(x => P.exec(x.c));
    P.exec('display current-configuration');
  }
  const s = document.querySelector('#prScreen');
  s.scrollTop = s.scrollHeight;
  document.getElementById('prCmd').value = 'display ip routing-table';

  out.total = out.ok.length + out.bad.length;
  out.pass = out.ok.length;
  return out;
})();
