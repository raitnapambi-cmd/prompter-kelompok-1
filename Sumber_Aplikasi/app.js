'use strict';
(() => {
 const DATA=JSON.parse(document.getElementById('projectData').textContent);
 const KEY='umkm-kelompok1-v3-progress';
 const main=document.getElementById('main');
 const $=id=>document.getElementById(id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||min));
 const defaults=()=>({schema:3,member:1,slide:1,tab:'home',theme:'light',font:34,speed:22,allSlides:false,learned:{},unsure:{},checks:{},active:{},help:[],quizHistory:[]});
 let storageOK=true,state=defaults(),tab='home',quiz=null,revealed=false,answerDraft='',questionFilter='Semua',quizPhase='Semua',practiceMode='quiz',sourceId='',qaQuery='';
 let scrolling=false,frame=0,lastFrame=0,scrollCarry=0,elapsed=0,startedAt=0,timerRunning=false,big=false;
 function sanitize(raw){
  const d=defaults();if(!raw||raw.schema!==3)return d;
  d.member=Math.round(clamp(raw.member,1,6));d.slide=Math.round(clamp(raw.slide,1,18));d.theme=raw.theme==='dark'?'dark':'light';d.font=clamp(raw.font,22,64);d.speed=clamp(raw.speed,6,70);d.allSlides=!!raw.allSlides;
  for(const id of [1,2,3,4,5,6]){
   d.learned[id]=Array.isArray(raw.learned?.[id])?[...new Set(raw.learned[id].filter(n=>Number.isInteger(n)&&n>=1&&n<=18))]:[];
   d.unsure[id]=Array.isArray(raw.unsure?.[id])?[...new Set(raw.unsure[id].filter(n=>Number.isInteger(n)&&n>=1&&n<=18))]:[];
   d.checks[id]=DATA.checklist.map((_,i)=>raw.checks?.[id]?.[i]===true);
   d.active[id]={};
   for(const k of ['study','practice']){const n=raw.active?.[id]?.[k];if(Number.isInteger(n)&&n>=1&&n<=18)d.active[id][k]=n;}
  }
  d.help=Array.isArray(raw.help)?raw.help.filter(x=>x&&Number.isInteger(x.member)&&x.member>=1&&x.member<=6&&Number.isInteger(x.slide)&&x.slide>=1&&x.slide<=18&&typeof x.text==='string').slice(0,100).map(x=>({id:String(x.id).slice(0,80),member:x.member,slide:x.slide,text:x.text.slice(0,2000),resolved:x.resolved===true})):[];
  d.quizHistory=Array.isArray(raw.quizHistory)?raw.quizHistory.filter(x=>x&&DATA.questions.some(q=>q.id===x.question)&&Number.isInteger(x.member)&&x.member>=1&&x.member<=6).slice(-200):[];
  return d;
 }
 try{const raw=localStorage.getItem(KEY);if(raw)state=sanitize(JSON.parse(raw));localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;} $('storageWarning').classList.toggle('hidden',storageOK);}
 function member(){return DATA.members.find(m=>m.id===state.member);}
 function slide(){return DATA.slides[state.slide-1];}
 function list(key,id=state.member){return state[key][id]??=[];}
 function checkCount(id){return (state.checks[id]??[]).filter(Boolean).length;}
 function learntCount(id){return DATA.members[id-1].slides.filter(n=>list('learned',id).includes(n)).length;}
 function ownStatus(id){const checks=checkCount(id),n=learntCount(id);return checks===5&&n===3?'Checklist persiapan lengkap':checks||n?'Persiapan berlangsung':'Belum ditandai';}
 function time(secs){const n=Math.max(0,Math.floor(secs));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
 function refs(ids){return ids.map(id=>`<button class="small-btn source-ref" data-action="source" data-id="${esc(id)}">${esc(id)}</button>`).join('');}
 function intro(title,text){return `<div class="intro"><p class="eyebrow">Kelompok 1 · V3 Final</p><h1>${esc(title)}</h1>${text?`<p class="lead">${esc(text)}</p>`:''}</div>`;}
 function memberSelect(){return `<label>Belajar sebagai <select id="memberSelect" aria-label="Pilih anggota">${DATA.members.map(m=>`<option value="${m.id}" ${m.id===state.member?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>`;}
 function setTheme(){document.documentElement.dataset.theme=state.theme;$('themeToggle').textContent=state.theme==='dark'?'Mode terang':'Mode gelap';}
 function rememberActive(){const a=state.active[state.member]??={};if(tab==='learn')a.study=state.slide;if(tab==='prompter')a.practice=state.slide;}
 function setTab(next,{slideNumber,memberId,id,focus=false}={}){
  pause();big=false;elapsed=0;
  if(memberId){state.member=clamp(memberId,1,6);if(!slideNumber)state.slide=member().slides[0];}
  if(slideNumber)state.slide=clamp(slideNumber,1,18);
  if(id)sourceId=id;
  if(next==='prompter'&&!state.allSlides&&!member().slides.includes(state.slide))state.slide=member().slides[0];
  tab=next;state.tab=next;rememberActive();save();render();
  document.querySelectorAll('[data-nav]').forEach(b=>{if(b.dataset.nav===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(focus)main.focus({preventScroll:true});
  window.scrollTo(0,0);
 }
 function route(){const v=location.hash.slice(1).split('/');if(v[0]==='prompter'&&/^[1-6]$/.test(v[1]??''))setTab('prompter',{memberId:Number(v[1])});else if(v[0]==='sources'&&v[1])setTab('source',{id:decodeURIComponent(v[1])});}
 function home(){return intro(DATA.title,DATA.subtitle)+
 `<p>Skenario ${time(DATA.totalSeconds)} untuk 18 slide. Pilih anggota untuk membuka narasinya.</p><div class="flow"><div><strong>C4 · Analisis</strong><p>Masalah, kebutuhan dan batas bukti.</p></div><div><strong>C5 · Evaluasi</strong><p>Empat pendekatan dengan tujuh kriteria.</p></div><div><strong>C6 · Rancangan</strong><p>Sembilan elemen BMC dan enam indikator MVP.</p></div></div>
 <div class="grid members">${DATA.members.map(m=>`<article class="card" data-member-card="${m.id}"><span class="tag">Slide ${m.slides[0]}–${m.slides[2]} · ${time(m.seconds)}</span><h3>${esc(m.name)}</h3><p class="nim">${m.nim}</p><p class="mini">${esc(m.role)}</p><div class="status">${esc(ownStatus(m.id))}<br>${learntCount(m.id)}/3 slide sendiri · ${checkCount(m.id)}/5 checklist</div><progress max="8" value="${learntCount(m.id)+checkCount(m.id)}" aria-label="Progres ${esc(m.name)}"></progress><div class="actions"><button class="primary" data-action="member-prompter" data-id="${m.id}">Buka prompter</button><button data-action="member-monitor" data-id="${m.id}">Kesiapan</button></div></article>`).join('')}</div>
 <div class="actions section"><button data-nav="learn">Pelajari seluruh 18 slide</button><button data-nav="practice">Latihan pemahaman</button><button data-nav="qa">36 pertanyaan dosen</button></div><p class="notice">${esc(DATA.evidenceBoundary)}</p>`;}
 function prompter(){
  const sl=slide(),m=member(),owner=DATA.members[sl.member-1],pool=state.allSlides?DATA.slides.map(s=>s.number):m.slides;
  const ix=pool.indexOf(sl.number);
  return `${intro('Prompter anggota',`${m.name} · NIM ${m.nim}`)}<div class="prompt-wrap${big?' big':''}" id="promptWrap"><div class="prompt-meta controls">${memberSelect()}<label><input id="allSlides" type="checkbox" ${state.allSlides?'checked':''}> Seluruh 18 slide</label></div><div class="prompt-meta slide-buttons">${pool.map(n=>`<button class="small-btn${n===sl.number?' selected':''}" data-action="prompt-slide" data-id="${n}" aria-pressed="${n===sl.number}">Slide ${n}</button>`).join('')}</div>
  <p class="eyebrow">Slide ${sl.number} · Sasaran ${sl.seconds} detik</p><h2 class="prompt-title">${esc(sl.title)}</h2><p class="prompt-meta muted">Penanggung jawab slide: ${esc(owner.name)}</p>
  <div class="controls"><button id="playPause" class="primary" data-action="play" aria-pressed="false">Mulai latihan</button><span id="timer" class="timer" role="timer" aria-label="Timer latihan">${time(elapsed/1000)}</span><button data-action="reset-timer" class="small-btn">Reset timer</button><label>Teks <input id="fontSize" type="range" min="22" max="64" value="${state.font}" aria-label="Ukuran teks"><output id="fontValue">${state.font}</output></label><label>Gulir <input id="scrollSpeed" type="range" min="6" max="70" value="${state.speed}" aria-label="Kecepatan gulir"><output id="speedValue">${state.speed}</output></label><button data-action="big" class="small-btn" id="bigToggle">${big?'Keluar teks besar':'Teks besar'}</button></div>
  <div class="prompt-box" id="promptBox" tabindex="0" aria-label="Narasi slide ${sl.number}" style="font-size:${state.font}px"><p>${esc(sl.script)}</p><p><strong>Transisi</strong><br>${esc(sl.transition)}</p><div class="prompt-tail" aria-hidden="true"></div></div><p id="scrollStatus" class="prompt-help">Gulir otomatis memakai kecepatan piksel per detik. Spasi untuk jeda atau lanjut.</p>
  <div class="actions toolbar-bottom"><button data-action="prompt-prev" ${ix<=0?'disabled':''}>Sebelumnya</button><button data-action="prompt-next" ${ix<0||ix>=pool.length-1?'disabled':''}>Berikutnya</button><button data-action="restart-scroll">Ke awal narasi</button></div></div>
  <section class="section"><h3>Inti yang perlu diingat</h3><ul>${sl.keys.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>${esc(sl.goal)}</p><div class="actions">${refs(sl.refs)}<button data-action="learn-slide" data-id="${sl.number}">Pelajari alasan dan istilah</button></div></section>`;
 }
 function tableHTML(rows){return `<div style="overflow-x:auto;margin:20px 0"><table style="border-collapse:collapse;min-width:850px;width:100%;font-size:15px">${rows.map((row,i)=>`<tr>${row.map(c=>`<${i?'td':'th'} style="border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top;${i?'':'background:var(--pale)'}">${esc(c).replace(/\n/g,'<br>')}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</table></div>`;}
 function learning(){
  const sl=slide(),m=member();
  const learned=list('learned').includes(sl.number),unsure=list('unsure').includes(sl.number);
  let extra='';
  if(sl.number===7)extra=`<details><summary>Alasan lengkap matriks empat alternatif</summary>${tableHTML(DATA.matrix)}<p class="mini">Kode sumber pada baris memberi dasar pertimbangan. Seluruh sel adalah analisis kelompok; nilai lokal tetap hipotesis.</p></details>`;
  if(sl.number===13)extra=`<details><summary>Definisi, metode dan keputusan enam indikator</summary>${DATA.metrics.slice(1).map((r,i)=>`<h3>${esc(r[0])}</h3><p>${esc(r[1])}</p><p class="muted">${esc(r[2])}</p><p><strong>Jika belum mendukung:</strong> ${esc(DATA.metricDecisions[i+1][1])}</p><p><strong>Jika mendukung:</strong> ${esc(DATA.metricDecisions[i+1][2])}</p>`).join('')}<h3>Aturan sebelum uji</h3>${DATA.protocol.map(p=>`<p>${esc(p)}</p>`).join('')}</details>`;
  return intro('Seluruh materi',`Semua anggota dapat membuka 18 slide. Progres dicatat untuk ${m.name}.`)+`<div class="controls">${memberSelect()}</div><div class="learn-layout"><aside class="slide-list" aria-label="Daftar 18 slide">${DATA.slides.map(s=>`<button data-action="learn-slide" data-id="${s.number}" class="${s.number===sl.number?'selected':''}" aria-pressed="${s.number===sl.number}"><span class="mark">${list('learned').includes(s.number)?'✓ ':''}${list('unsure').includes(s.number)?'? ':''}</span>${s.number}. ${esc(s.title)}</button>`).join('')}</aside><article class="topic-body"><p class="eyebrow">Slide ${sl.number} · ${esc(sl.phase)}</p><h2>${esc(sl.title)}</h2>${sl.preview?`<img class="slide-image" src="${sl.preview}" alt="Slide ${sl.number}: ${esc(sl.title)}">`:''}<h3>Ringkasan</h3><p>${esc(sl.summary)}</p><h3>Alasan dan penjelasan</h3><p>${esc(sl.deep)}</p><p>${esc(sl.before)} ${esc(sl.after)}</p>${sl.example?`<p class="notice"><strong>Contoh hipotetis</strong><br>${esc(sl.example)}</p>`:''}
  <details open><summary>Istilah yang perlu dipahami</summary><dl class="term-list">${sl.terms.map(term=>`<dt>${esc(term)}</dt><dd>${esc(DATA.terms[term])}</dd>`).join('')}</dl></details><details><summary>Narasi lisan dan transisi</summary><p>${esc(sl.script)}</p><p><strong>Transisi:</strong> ${esc(sl.transition)}</p></details>${extra}<details><summary>Catatan pembicara lengkap</summary><p class="mini" style="white-space:pre-line">${esc(sl.speakerNotes||sl.deep)}</p></details>
  <p class="mini muted">${esc(sl.documentLocator)}</p><div class="actions">${refs(sl.refs)}</div><div class="actions"><button data-action="toggle-learned" aria-pressed="${learned}">${learned?'✓ Sudah dipelajari':'Tandai sudah dipelajari'}</button><button data-action="toggle-unsure" aria-pressed="${unsure}">${unsure?'? Masih perlu dipahami':'Tandai belum paham'}</button><button class="primary" data-action="practice-slide" data-id="${sl.number}">Latih narasi ini</button></div><section class="section"><h3>Catatan untuk diskusi kelompok</h3><textarea id="discussionText" class="discussion-note" placeholder="Tuliskan bagian yang perlu dibahas bersama…" aria-label="Catatan diskusi"></textarea><button data-action="add-help">Simpan catatan</button><p id="helpStatus" class="mini" role="status">Catatan disimpan hanya di perangkat ini.</p></section></article></div>`;
 }
 function tokens(query){const stop=new Set(['apa','yang','dan','di','ke','dari','mengapa','bagaimana','adalah','untuk']);return norm(query).split(' ').filter(x=>x&&!stop.has(x));}
 function matches(record,query){const ts=tokens(query);const text=norm(record);return !ts.length||ts.every(t=>text.includes(t));}
 function knowledgeSearch(query=''){
  const queryWords=tokens(query);
  const ks=DATA.knowledge.filter(k=>matches(`${k.title} ${k.phase} ${k.summary} ${k.detail} ${k.terms?.join(' ')}`,query)).sort((a,b)=>queryWords.reduce((v,t)=>v+(norm(b.title).includes(t)?1:0)-(norm(a.title).includes(t)?1:0),0));
  const qs=queryWords.length?DATA.questions.filter(q=>matches(`${q.question} ${q.short} ${q.deep} ${q.category}`,query)):[];
  return intro('Ringkasan dan istilah','Pencarian indeks lokal terkurasi. Gunakan topik seperti C5, kepercayaan, M4, Stevenson, atau biaya.')+`<p class="q-count" role="status">${ks.length} topik${qs.length?` dan ${qs.length} pertanyaan`:''}${query?` untuk “${esc(query)}”`:''}.</p><section class="search-group">${ks.length?ks.map(k=>`<article class="result"><h3>${esc(k.title)}</h3><p>${esc(k.summary)}</p><details><summary>Penjelasan dan keterkaitan</summary><p>${esc(k.detail)}</p>${k.reason?`<p><strong>Alasan:</strong> ${esc(k.reason)}</p>`:''}<p class="mini">${esc(k.locator)}</p><div class="actions">${(k.relatedSlides||[]).map(n=>`<button class="small-btn" data-action="learn-slide" data-id="${n}">Slide ${n}</button>`).join('')}${refs(k.refs||[])}</div></details></article>`).join(''):'<p class="empty">Topik belum ditemukan. Coba kata kunci yang lebih singkat.</p>'}</section>${qs.length?`<section><h2>Pertanyaan terkait</h2>${qaItems(qs)}</section>`:''}`;
 }
 function qaItems(items){return items.map(q=>`<article class="qa-item" data-question-id="${q.id}"><p class="eyebrow">${esc(q.category)} · Slide ${q.slide}</p><h3>${esc(q.question)}</h3><p>${esc(q.short)}</p><details><summary>Jawaban mendalam dan dasar argumen</summary><p>${esc(q.deep)}</p>${q.reason!==q.deep?`<p><strong>Dasar akademik:</strong> ${esc(q.reason)}</p>`:''}<p class="mini">${esc(DATA.slides[q.slide-1].documentLocator)}</p><p class="mini">Anggota terkait: ${esc(DATA.members[q.member-1].name)}</p><div class="actions">${refs(q.refs)}<button data-action="learn-slide" data-id="${q.slide}" class="small-btn">Pelajari slide ${q.slide}</button></div></details></article>`).join('');}
 function filterQuestions(){return DATA.questions.filter(q=>(questionFilter==='Semua'||q.category===questionFilter)&&matches(`${q.question} ${q.short} ${q.deep} ${q.category}`,qaQuery));}
 function qa(){const categories=[...new Set(DATA.questions.map(q=>q.category))];return intro('Bank pertanyaan dosen','Jawaban mengacu pada kajian V3 dan batas sumber. Semua anggota dapat mempelajari seluruh kategori.')+`<div class="filters"><input id="qaSearch" type="search" aria-label="Cari pertanyaan dosen" placeholder="Cari pertanyaan…" value="${esc(qaQuery)}"><select id="qaCategory" aria-label="Kategori pertanyaan"><option>Semua</option>${categories.map(c=>`<option ${c===questionFilter?'selected':''}>${esc(c)}</option>`).join('')}</select></div><p id="qaCount" class="q-count" role="status">${filterQuestions().length} pertanyaan</p><div id="qaList">${qaItems(filterQuestions())}</div>`;}
 function drawQA(){const items=filterQuestions();$('qaList').innerHTML=qaItems(items)||'<p class="empty">Tidak ada pertanyaan yang cocok.</p>';$('qaCount').textContent=`${items.length} pertanyaan`;}
 function quizPool(){const pool=practiceMode==='simulation'?DATA.questions:DATA.questions.slice(0,18);return pool.filter(q=>quizPhase==='Semua'||DATA.slides[q.slide-1].phase===quizPhase);}
 function chooseQuiz(){const pool=quizPool();const candidates=pool.filter(q=>q.id!==quiz?.id);quiz=(candidates.length?candidates:pool)[Math.floor(Math.random()*(candidates.length||pool.length))]||null;revealed=false;answerDraft='';}
 function practice(){if(!quiz||!quizPool().some(q=>q.id===quiz.id))chooseQuiz();return intro('Latihan pemahaman','Coba jawab dengan kata-kata sendiri, lalu bandingkan argumennya. Penilaian pemahaman dilakukan sendiri.')+`<div class="controls">${memberSelect()}<label>Materi <select id="quizPhase"><option>Semua</option>${['C4','C5','C6'].map(p=>`<option ${p===quizPhase?'selected':''}>${p}</option>`).join('')}</select></label><label>Mode <select id="practiceMode"><option value="quiz" ${practiceMode==='quiz'?'selected':''}>Kuis 18 slide</option><option value="simulation" ${practiceMode==='simulation'?'selected':''}>Simulasi dosen</option></select></label></div><section class="card quiz-panel">${quiz?`<p class="eyebrow">${esc(quiz.category)} · Slide ${quiz.slide}</p><h2 id="quizQuestion">${esc(quiz.question)}</h2><label for="quizAnswer">Jawaban percobaan</label><textarea id="quizAnswer" class="quiz-answer" placeholder="Jelaskan alasan dan batas buktinya…">${esc(answerDraft)}</textarea><p id="quizStatus" class="mini" role="status"></p><div class="actions"><button class="primary" data-action="reveal-answer" ${revealed?'disabled':''}>Bandingkan jawaban</button><button data-action="next-question">Pertanyaan acak berikutnya</button></div><div id="quizFeedback" class="${revealed?'':'hidden'}">${revealed?quizFeedback():''}</div>`:'<p class="empty">Tidak ada soal pada kategori ini.</p>'}</section>`;}
 function quizFeedback(){return `<div class="notice"><h3>Inti jawaban</h3><p>${esc(quiz.short)}</p><p>${esc(quiz.deep)}</p><p class="mini">Dasar: ${esc(DATA.slides[quiz.slide-1].documentLocator)}</p><div class="actions">${refs(quiz.refs)}</div></div><div class="actions"><button data-action="quiz-understood">Sudah memahami alasan</button><button data-action="quiz-unsure">Perlu dipelajari lagi</button><button data-action="learn-slide" data-id="${quiz.slide}">Buka materi</button></div><p class="mini">Tidak ada penilaian otomatis atas teks jawaban. Penanda ini merupakan penilaian diri.</p>`;}
 function monitoring(){const m=member(),checks=state.checks[m.id]??DATA.checklist.map(()=>false),active=state.active[m.id]??{},current=active.practice?DATA.slides[active.practice-1]:null,studied=active.study?DATA.slides[active.study-1]:null,next=DATA.members[(current?.member??m.id)]||null,helps=state.help.filter(h=>h.member===m.id);
  return intro('Kesiapan anggota','Monitor ini merangkum catatan latihan pada perangkat ini. Perangkat lain memiliki progresnya sendiri.')+`<div class="controls">${memberSelect()}</div><div class="grid monitor-grid"><section class="card"><h2>${esc(m.name)}</h2><p class="nim">${m.nim}</p><p>${esc(ownStatus(m.id))}</p><p>Slide sendiri dipelajari: ${learntCount(m.id)}/3. Seluruh materi: ${list('learned').length}/18.</p><progress value="${checkCount(m.id)+learntCount(m.id)}" max="8" aria-label="Progres persiapan anggota"></progress><ul class="checklist">${DATA.checklist.map((text,i)=>`<li><label><input type="checkbox" data-check="${i}" ${checks[i]?'checked':''}>${esc(text)}</label></li>`).join('')}</ul></section><section class="card"><h3>Aktivitas terakhir yang dipilih</h3><p><strong>Dipakai belajar:</strong> ${studied?`Slide ${studied.number} · ${esc(studied.title)}`:'Belum dipilih'}</p><p><strong>Aktif saat latihan:</strong> ${current?`Slide ${current.number} · ${esc(current.title)}`:'Belum dipilih'}</p><p class="mini">Giliran anggota berikutnya: ${next?esc(next.name):'Taufik memoderasi tanya jawab setelah penutup.'}</p><h3 class="section">Materi yang perlu dipahami lagi</h3>${list('unsure').length?list('unsure').map(n=>`<p><button class="small-btn" data-action="learn-slide" data-id="${n}">Slide ${n} · ${esc(DATA.slides[n-1].title)}</button></p>`).join(''):'<p class="muted">Belum ada penanda kesulitan.</p>'}<p class="mini">Latihan tersimpan: ${state.quizHistory.filter(x=>x.member===m.id).length} penilaian diri.</p><div class="actions"><button data-action="member-prompter" data-id="${m.id}">Latih tiga slide sendiri</button></div></section></div><section class="section"><h2>Catatan bantuan dan diskusi</h2>${helps.length?helps.map(h=>`<article class="qa-item"><p>Slide ${h.slide} · ${esc(h.text)}</p><label><input type="checkbox" data-help="${esc(h.id)}" ${h.resolved?'checked':''}> Sudah dibahas</label></article>`).join(''):'<p class="muted">Belum ada catatan. Tambahkan dari halaman materi.</p>'}</section><section class="section"><h2>Cadangan progres</h2><p>Ekspor sebagai berkas JSON. Impor mengganti progres pada perangkat ini dengan isi cadangan yang dipilih.</p><div class="actions"><button data-action="export-progress">Ekspor progres</button><button data-action="import-progress">Impor cadangan progres</button></div><p id="importStatus" class="mini" role="status"></p></section>`;
 }
 function sources(){return intro('Perpustakaan sumber offline','PDF jurnal asli, dokumen V3 dan materi kuliah tersedia di folder Sumber. Buka setelah seluruh ZIP diekstrak.')+`<div class="filters"><input id="sourceSearch" type="search" aria-label="Cari sumber" placeholder="Cari kode, judul, atau penulis…"></div><p class="notice">Status verifikasi berlaku pada klaim dan halaman terpilih yang diperiksa. Keberadaan PDF tidak berarti setiap sumber sekundernya telah diverifikasi.</p><div id="sourceList" class="grid source-list">${sourceCards(DATA.references)}</div>`;}
 function sourceCards(items){return items.map(r=>`<article class="card"><p class="eyebrow">${esc(r.id)} · ${esc(r.year)}</p><h3>${esc(r.title)}</h3><p class="mini">${esc(r.authors)}</p><p>${esc(r.summary)}</p><p class="mini muted">${esc(r.verifiedPages)}</p><div class="actions"><button data-action="source" data-id="${esc(r.id)}">Detail dan batas bukti</button><a href="${esc(encodeURI(r.file))}" target="_blank" rel="noopener">Buka PDF lokal</a></div></article>`).join('');}
 function sourceDetail(){const r=DATA.references.find(r=>r.id===sourceId);if(!r)return intro('Sumber belum ditemukan','Kembali ke daftar sumber.')+`<button data-nav="sources">Daftar sumber</button>`;return intro(`${r.id} · ${r.title}`,r.authors)+`<article class="source-detail"><p>${esc(r.full)}</p><h3>Temuan atau peran sumber</h3><p>${esc(r.summary)}</p>${r.method?`<h3>Metode dan konteks</h3><p>${esc(r.method)}</p>`:''}<h3>Batas penafsiran</h3><p>${esc(r.limitations)}</p><p class="notice">${esc(r.status)}</p><p><strong>Bagian atau halaman terpilih:</strong> ${esc(r.verifiedPages)}</p><div class="actions">${r.slides.map(n=>`<button class="small-btn" data-action="learn-slide" data-id="${n}">Slide ${n}</button>`).join('')}</div><div class="actions"><a href="${esc(encodeURI(r.file))}" target="_blank" rel="noopener">Buka PDF lokal</a><button data-nav="sources">Semua sumber</button></div></article>`;}
 function render(){const routes={home,prompter,learn:learning,search:()=>knowledgeSearch($('globalSearch').value),qa,practice,monitor:monitoring,sources,source:sourceDetail};main.innerHTML=(routes[tab]||home)();setTheme();$('storageWarning').classList.toggle('hidden',storageOK);}
 function currentElapsed(){return elapsed+(timerRunning?performance.now()-startedAt:0);}
 function pause(){if(timerRunning){elapsed=currentElapsed();timerRunning=false;}scrolling=false;cancelAnimationFrame(frame);lastFrame=0;const b=$('playPause');if(b){b.textContent='Lanjut latihan';b.setAttribute('aria-pressed','false');}}
 function scrollTick(now){if(!scrolling)return;const box=$('promptBox');if(!box){pause();return;}if(lastFrame){const delta=state.speed*Math.min((now-lastFrame)/1000,.1)+scrollCarry;const px=Math.floor(delta);if(px)box.scrollTop+=px;scrollCarry=delta-px;}lastFrame=now;if(box.scrollTop>=box.scrollHeight-box.clientHeight-1){scrolling=false;const status=$('scrollStatus');if(status)status.textContent='Akhir narasi. Timer tetap berjalan sampai latihan dijeda.';}else frame=requestAnimationFrame(scrollTick);}
 function play(){if(timerRunning){pause();return;}timerRunning=true;startedAt=performance.now();scrolling=true;lastFrame=0;$('playPause').textContent='Jeda latihan';$('playPause').setAttribute('aria-pressed','true');$('scrollStatus').textContent='Latihan berjalan. Spasi untuk jeda.';frame=requestAnimationFrame(scrollTick);}
 function changePrompt(n){pause();elapsed=0;state.slide=n;rememberActive();save();render();}
 function mark(key,n,on){const items=list(key),i=items.indexOf(n);if(on&&i<0)items.push(n);if(!on&&i>=0)items.splice(i,1);save();}
 document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');if(nav){setTab(nav.dataset.nav,{focus:true});return;}
  const b=e.target.closest('[data-action]');if(!b)return;const n=Number(b.dataset.id),action=b.dataset.action;
  if(action==='member-prompter'){state.allSlides=false;setTab('prompter',{memberId:n});}
  else if(action==='member-monitor')setTab('monitor',{memberId:n});
  else if(action==='learn-slide')setTab('learn',{slideNumber:n});
  else if(action==='prompt-slide')changePrompt(n);
  else if(action==='practice-slide'){state.allSlides=true;setTab('prompter',{slideNumber:n});}
  else if(action==='source')setTab('source',{id:b.dataset.id});
  else if(action==='play')play();
  else if(action==='reset-timer'){pause();elapsed=0;$('timer').textContent='00:00';}
  else if(action==='big'){big=!big;$('promptWrap').classList.toggle('big',big);$('bigToggle').textContent=big?'Keluar teks besar':'Teks besar';}
  else if(action==='restart-scroll'){$('promptBox').scrollTop=0;$('scrollStatus').textContent='Narasi kembali ke awal.';}
  else if(action==='prompt-prev'||action==='prompt-next'){const pool=state.allSlides?DATA.slides.map(s=>s.number):member().slides;const ix=pool.indexOf(state.slide)+(action==='prompt-next'?1:-1);if(ix>=0&&ix<pool.length)changePrompt(pool[ix]);}
  else if(action==='toggle-learned'){mark('learned',state.slide,!list('learned').includes(state.slide));render();}
  else if(action==='toggle-unsure'){mark('unsure',state.slide,!list('unsure').includes(state.slide));render();}
  else if(action==='add-help'){const text=$('discussionText').value.trim();if(!text){$('helpStatus').textContent='Tuliskan catatan terlebih dahulu.';return;}state.help.push({id:`h${Date.now()}-${Math.random().toString(36).slice(2,8)}`,member:state.member,slide:state.slide,text:text.slice(0,2000),resolved:false});save();$('discussionText').value='';$('helpStatus').textContent='Catatan tersimpan pada monitor kesiapan perangkat ini.';}
  else if(action==='reveal-answer'){answerDraft=$('quizAnswer').value.trim();if(!answerDraft){$('quizStatus').textContent='Coba tulis jawaban singkat sebelum membuka pembahasan.';return;}revealed=true;b.disabled=true;$('quizFeedback').innerHTML=quizFeedback();$('quizFeedback').classList.remove('hidden');$('quizStatus').textContent='Bandingkan alasan dan keterbatasannya, lalu nilai pemahaman sendiri.';}
  else if(action==='next-question'){chooseQuiz();render();}
  else if(action==='quiz-understood'||action==='quiz-unsure'){const understood=action==='quiz-understood';state.quizHistory.push({member:state.member,question:quiz.id,slide:quiz.slide,understood,time:new Date().toISOString()});if(state.quizHistory.length>200)state.quizHistory.shift();mark('unsure',quiz.slide,!understood);if(understood)mark('learned',quiz.slide,true);save();$('quizStatus').textContent=understood?'Penanda pemahaman tersimpan.':'Topik ditandai untuk dipelajari lagi.';}
  else if(action==='export-progress'){const payload={type:'umkm-group1-progress-v3',version:3,exportedAt:new Date().toISOString(),progress:state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='progres-kelompok1-v3.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  else if(action==='import-progress')$('importFile').click();
 });
 document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='memberSelect'){pause();elapsed=0;state.member=Number(t.value);if(tab==='prompter'&&!state.allSlides)state.slide=member().slides[0];rememberActive();save();render();}
  else if(t.id==='allSlides'){pause();state.allSlides=t.checked;if(!t.checked&&!member().slides.includes(state.slide))state.slide=member().slides[0];rememberActive();save();render();}
  else if(t.id==='qaCategory'){questionFilter=t.value;drawQA();}
  else if(t.id==='quizPhase'){quizPhase=t.value;chooseQuiz();render();}
  else if(t.id==='practiceMode'){practiceMode=t.value;chooseQuiz();render();}
  else if(t.dataset.check!==undefined){(state.checks[state.member]??=DATA.checklist.map(()=>false))[Number(t.dataset.check)]=t.checked;save();render();}
  else if(t.dataset.help){const h=state.help.find(h=>h.id===t.dataset.help);if(h){h.resolved=t.checked;save();}}
 });
 document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='globalSearch'){if(tab!=='search'){pause();tab='search';document.querySelectorAll('[data-nav]').forEach(b=>{if(b.dataset.nav==='search')b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}main.innerHTML=knowledgeSearch(t.value);}
  else if(t.id==='qaSearch'){qaQuery=t.value;drawQA();}
  else if(t.id==='sourceSearch')$('sourceList').innerHTML=sourceCards(DATA.references.filter(r=>matches(`${r.id} ${r.title} ${r.authors} ${r.summary}`,t.value)))||'<p class="empty">Sumber tidak ditemukan.</p>';
  else if(t.id==='fontSize'){state.font=Number(t.value);$('promptBox').style.fontSize=state.font+'px';$('fontValue').textContent=state.font;save();}
  else if(t.id==='scrollSpeed'){state.speed=Number(t.value);$('speedValue').textContent=state.speed;save();}
  else if(t.id==='quizAnswer')answerDraft=t.value;
 });
 $('searchForm').addEventListener('submit',e=>{e.preventDefault();setTab('search');});
 $('themeToggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';save();setTheme();});
 $('importFile').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{if(f.size>2000000)throw Error('Cadangan terlalu besar.');const payload=JSON.parse(await f.text());if(payload.type!=='umkm-group1-progress-v3'||payload.progress?.schema!==3)throw Error('Format cadangan tidak cocok.');state=sanitize(payload.progress);save();setTab('monitor');$('importStatus').textContent='Cadangan berhasil dimuat pada perangkat ini.';}
  catch(error){if($('importStatus'))$('importStatus').textContent='Impor gagal: '+error.message;}
  e.target.value='';
 });
 document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;if(tab==='prompter'){if(e.code==='Space'){e.preventDefault();play();}else if(e.key==='Escape'&&big){big=false;$('promptWrap').classList.remove('big');$('bigToggle').textContent='Teks besar';}else if(e.key==='ArrowRight')document.querySelector('[data-action="prompt-next"]')?.click();else if(e.key==='ArrowLeft')document.querySelector('[data-action="prompt-prev"]')?.click();}});
 window.addEventListener('hashchange',route);window.addEventListener('beforeunload',()=>{pause();save();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 setInterval(()=>{const target=$('timer');if(target){const secs=currentElapsed()/1000;target.textContent=time(secs);target.classList.toggle('time-over',secs>slide().seconds);}},250);
 setTheme();save();setTab('home');route();
})();
