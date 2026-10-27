const groups=[
 {name:'ヒドロキシ基',structure:'−OH',category:'アルコール',formula:'R−OH',example:'エタノール'},
 {name:'エーテル結合',structure:'−O−',category:'エーテル',formula:'R¹−O−R²',example:'ジエチルエーテル'},
 {name:'ホルミル基',structure:'−CHO',category:'アルデヒド',formula:'R−CHO',example:'アセトアルデヒド'},
 {name:'カルボニル基',structure:'−CO−',category:'ケトン',formula:'R¹−CO−R²',example:'アセトン'},
 {name:'カルボキシ基',structure:'−COOH',category:'カルボン酸',formula:'R−COOH',example:'酢酸'},
 {name:'エステル結合',structure:'−COO−',category:'エステル',formula:'R¹−COO−R²',example:'酢酸エチル'},
 {name:'ニトロ基',structure:'−NO₂',category:'ニトロ化合物',formula:'R−NO₂',example:'ニトロベンゼン'},
 {name:'アミノ基',structure:'−NH₂',category:'アミン',formula:'R−NH₂',example:'アニリン'},
 {name:'スルホ基',structure:'−SO₃H',category:'スルホン酸',formula:'R−SO₃H',example:'ベンゼンスルホン酸'}
];
let matchRound=0,matchCorrect=0,blankRound=0,blankCorrect=0,selectedStructure=null,selectedCategory=null,currentMatch=[];
const $=s=>document.querySelector(s),shuffle=a=>[...a].sort(()=>Math.random()-.5);
function show(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active')}
document.querySelectorAll('.mode-card').forEach(b=>b.onclick=()=>{show(b.dataset.mode);b.dataset.mode==='match'?renderMatch():renderBlank()});
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>show('briefing'));
function renderMatch(){selectedStructure=selectedCategory=null;currentMatch=shuffle(groups).slice(0,5);$('#match-score').textContent=matchCorrect;const structures=$('#structure-list'),categories=$('#category-list');structures.innerHTML='';categories.innerHTML='';currentMatch.forEach((g,i)=>{let b=document.createElement('button');b.className='choice';b.innerHTML=`<span>${g.name}</span><span class="formula">${g.structure}</span>`;b.onclick=()=>pick(b,'structure',g);structures.append(b)});shuffle(currentMatch).forEach(g=>{let b=document.createElement('button');b.className='choice';b.textContent=g.category;b.onclick=()=>pick(b,'category',g);categories.append(b)});}
function pick(button,type,g){if(button.classList.contains('good')||button.classList.contains('bad'))return;document.querySelectorAll(`#${type==='structure'?'structure':'category'}-list .choice`).forEach(x=>x.classList.remove('selected'));button.classList.add('selected');if(type==='structure')selectedStructure={button,g};else selectedCategory={button,g};if(selectedStructure&&selectedCategory){const good=selectedStructure.g.name===selectedCategory.g.name;selectedStructure.button.classList.add(good?'good':'bad');selectedCategory.button.classList.add(good?'good':'bad');if(good){matchCorrect++;$('#match-score').textContent=matchCorrect}setTimeout(()=>{selectedStructure=selectedCategory=null;document.querySelectorAll('.choice.selected').forEach(x=>x.classList.remove('selected'))},250)}}
$('#next-match').onclick=()=>{matchRound++;renderMatch()};
function renderBlank(){const g=groups[blankRound%groups.length],pattern=blankRound%3;const asks=pattern===0?['一般式 '+g.formula+' をもつ化合物の分類は？',g.category]:pattern===1?['官能基 '+g.structure+' の名称は？',g.name]:['例：'+g.example+' に含まれる官能基の構造は？',g.structure];$('#blank-score').textContent=blankCorrect;$('#question-card').innerHTML=`<p class="question-label">RECOVER THE MISSING DATA</p><p class="prompt">${asks[0]}</p><p class="chemical">[　　？　　]</p>`;const opts=shuffle([asks[1],...shuffle(groups.filter(x=>x.name!==g.name)).slice(0,3).map(x=>pattern===0?x.category:pattern===1?x.name:x.structure)]);const box=$('#answer-options');box.innerHTML='';$('#feedback').textContent='';opts.forEach(o=>{let b=document.createElement('button');b.className='answer';b.textContent=o;b.onclick=()=>answerBlank(b,o,asks[1],g);box.append(b)});}
function answerBlank(button,value,correct,g){if($('#feedback').textContent)return;document.querySelectorAll('.answer').forEach(x=>x.disabled=true);if(value===correct){button.classList.add('good');blankCorrect++;$('#feedback').textContent='IDENTIFIED — 正解。 '+g.name+' は '+g.category+' に対応する。';$('#feedback').className='feedback good'}else{button.classList.add('bad');[...document.querySelectorAll('.answer')].find(x=>x.textContent===correct).classList.add('good');$('#feedback').textContent='NOT MATCHED — 正解は「'+correct+'」。';$('#feedback').className='feedback bad'}$('#blank-score').textContent=blankCorrect}
$('#next-blank').onclick=()=>{blankRound++;renderBlank()};
