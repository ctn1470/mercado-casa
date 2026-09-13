/* Local recipe suggestions. Reads inventory; never writes purchases or stock. */
(()=>{
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const ingredient=(name,quantity,unit,aliases=[])=>({name,quantity,unit,aliases:[name,...aliases]});
const oil=ingredient('Aceite de oliva',5,'ml',['Aceite girasol']);
const tomato=ingredient('Tomate',80,'g',['Tomate aliño','Tomate cherry']);
const onion=ingredient('Cebolla',25,'g',['Cebolla blanca','Cebolla roja']);
const garlic=ingredient('Ajo',2,'g');
const proteins={
 eggs:{label:'Huevos',item:ingredient('Huevos',2,'unidades'),cook:'Bate los huevos y cuájalos en una sartén antiadherente, removiendo, hasta que no queden partes líquidas.'},
 chicken:{label:'Pollo',item:ingredient('Pollo',150,'g'),cook:'Corta el pollo deshuesado en tiras. Cocínalo en la sartén, girándolo, hasta alcanzar 74 °C en el centro con termómetro; no te guíes solo por el color.'},
 beef:{label:'Carne de res',item:ingredient('Solomito',150,'g',['Carne de res']),cook:'Corta la carne de res de pieza entera en tiras. Cocínala en la sartén hasta alcanzar al menos 63 °C y déjala reposar 3 minutos antes de servir.'},
 tuna:{label:'Atún en conserva',item:ingredient('Atún',100,'g'),cook:'Usa atún en conserva listo para consumir: escúrrelo y caliéntalo brevemente en la sartén. Esta preparación no está pensada para atún crudo.'},
 cheese:{label:'Queso',item:ingredient('Quesito',80,'g',['Mozzarella en bloque','Mozzarella tajado','Queso']),cook:'Corta el queso en dados o tiras y agrégalo al final, con el fuego bajo, hasta que se caliente o se ablande.'},
 lentils:{label:'Lentejas',item:ingredient('Lentejas',70,'g'),cook:'Enjuaga las lentejas secas y cuécelas en abundante agua de 25 a 35 minutos, o hasta que estén tiernas. Escurre antes de mezclarlas con la preparación.'}
};
const sides={
 arepa:{label:'Arepa',item:ingredient('Arepa blanca',1,'unidad',['Arepa de yuca']),cook:'Calienta las arepas ya elaboradas según su envase, girándolas para que se calienten por ambos lados.'},
 bread:{label:'Pan',item:ingredient('Pan tajado',2,'rebanadas',['Pan francés']),cook:'Tuesta el pan al gusto y sírvelo al lado de la proteína.'},
 rice:{label:'Arroz',item:ingredient('Arroz blanco',70,'g'),cook:'Lava el arroz y cocínalo según la proporción de agua y el tiempo del envase. La cantidad indicada es en seco.'},
 potato:{label:'Papa',item:ingredient('Papa Capira',200,'g',['Papa Nevada','Papa criolla']),cook:'Lava y corta las papas en cubos. Cúbrelas con agua y hiérvelas de 15 a 20 minutos, hasta que estén tiernas; escurre.'},
 pasta:{label:'Pasta',item:ingredient('Pasta corta',80,'g',['Pasta larga']),cook:'Cuece la pasta en abundante agua durante el tiempo indicado en el envase y escúrrela. La cantidad indicada es en seco.'},
 salad:{label:'Ensalada',items:[tomato,ingredient('Zanahoria',60,'g')],cook:'Lava el tomate y la zanahoria, corta el tomate y ralla la zanahoria. Sirve esta ensalada por separado, sin mezclarla con alimentos crudos de origen animal.'}
};
const variants={
 breakfast:[{name:'con tomate y cebolla',items:[tomato,onion],cook:'Pica el tomate y la cebolla. Sofríe primero la cebolla y luego el tomate durante 5 a 7 minutos.'},{name:'con ajo y orégano',items:[garlic,ingredient('Orégano',.3,'g')],cook:'Pica el ajo y caliéntalo suavemente durante 30 segundos sin quemarlo. Reserva el orégano para el final.'},{name:'con zanahoria salteada',items:[ingredient('Zanahoria',60,'g')],cook:'Ralla la zanahoria y saltéala de 4 a 6 minutos hasta que se ablande.'}],
 lunch:[{name:'en salsa de tomate casera',items:[tomato,onion,garlic],cook:'Pica tomate, cebolla y ajo. Sofríe la cebolla y el ajo; agrega el tomate y cocina a fuego bajo durante 10 minutos.'},{name:'al ajo y perejil',items:[garlic,ingredient('Perejil seco',.5,'g')],cook:'Calienta el ajo picado suavemente durante 30 segundos. Agrega el perejil al terminar la cocción de la proteína.'},{name:'con verduras salteadas',items:[ingredient('Zanahoria',70,'g'),onion],cook:'Corta la zanahoria en tiras finas y la cebolla en láminas. Saltéalas de 6 a 8 minutos hasta ablandarlas.'}],
 dinner:[{name:'con verduras suaves',items:[ingredient('Zanahoria',60,'g'),tomato],cook:'Corta las verduras en dados pequeños y cocínalas a fuego medio de 8 a 10 minutos.'},{name:'al orégano',items:[garlic,ingredient('Orégano',.3,'g')],cook:'Calienta el ajo picado durante 30 segundos sin dorarlo en exceso. Incorpora el orégano al final.'},{name:'con cebolla y tomate',items:[onion,tomato],cook:'Corta la cebolla en láminas y cocínala 5 minutos; añade el tomate picado y cocina otros 5 minutos.'}]
};
let menus=[],selected=null,portions=null,submitted=false;
function stock(i){
 const names=i.aliases.map(normalize);
 const matches=state.products.filter(p=>!p.archived&&names.includes(normalize(p.name)));
 return matches.find(p=>p.status==='enough')||matches.find(p=>p.status==='low')||matches[0];
}
function statusText(i){const p=stock(i);return !p?'No registrado':p.status==='enough'?'Hay suficiente':p.status==='low'?'Queda poco · comprueba la cantidad':'Se acabó'}
function aggregate(items){const result=[];for(const i of items){const found=result.find(x=>x.name===i.name&&x.unit===i.unit);if(found)found.quantity+=i.quantity;else result.push({...i})}return result}
function ingredients(v){const protein=proteins[$('#recipeProtein').value],side=sides[$('#recipeSide').value];return aggregate([protein.item,...(side.items||[side.item]),oil,...v.items])}
function title(v){return `${proteins[$('#recipeProtein').value].label} ${v.name} con ${sides[$('#recipeSide').value].label.toLowerCase()}`}
function analyze(v){const items=ingredients(v);return {items,missing:items.filter(i=>!stock(i)||!['enough','low'].includes(stock(i).status)),low:items.filter(i=>stock(i)?.status==='low')}}
function updateOverview(){
 const active=state.products.filter(p=>!p.archived);
 $('#recipeInventory').textContent=`Inventario actual: ${active.filter(p=>p.status==='enough').length} con suficiente, ${active.filter(p=>p.status==='low').length} con poco y ${active.filter(p=>p.status==='out').length} agotados. Los archivados no se consideran disponibles.`;
 for(const [id,options] of [['recipeProtein',proteins],['recipeSide',sides]])for(const option of document.getElementById(id).options){const entry=options[option.value];if(entry){const items=entry.items||[entry.item];option.textContent=entry.label+' — '+(items.every(i=>stock(i)?.status==='enough')?'disponible':items.every(i=>['enough','low'].includes(stock(i)?.status))?'queda poco':'faltan ingredientes')}}
}
function showMenus(){
 menus=variants[$('#recipeMeal').value].map(v=>({...v,report:analyze(v)})).sort((a,b)=>a.report.missing.length-b.report.missing.length||a.report.low.length-b.report.low.length);
 $('#recipeMenus').innerHTML=menus.map((v,index)=>`<article class="product-card"><h3>${esc(title(v))}</h3><p>${v.report.missing.length?`Falta comprobar o conseguir: ${v.report.missing.map(i=>esc(i.name)).join(', ')}.`:'Todos los ingredientes están marcados como disponibles.'}</p>${v.report.low.length?`<p>Queda poco: ${v.report.low.map(i=>esc(i.name)).join(', ')}.</p>`:''}<button type="button" class="primary" data-recipe-index="${index}">Elegir esta opción</button></article>`).join('');
 $('#recipeMenus').querySelectorAll('[data-recipe-index]').forEach(button=>button.onclick=()=>{selected=menus[Number(button.dataset.recipeIndex)];portions=null;$('#recipeDetail').innerHTML='';$('#recipePeoplePanel').classList.remove('hidden');$('#recipeChosen').textContent=title(selected);$('#recipePeople').value='';$('#recipePeople').focus()});
}
function showRecipe(){
 if(!selected||!portions)return;
 const p=proteins[$('#recipeProtein').value],s=sides[$('#recipeSide').value],report=analyze(selected);
 const fmt=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(n);
 $('#recipeDetail').innerHTML=`<article class="product-card"><h2>${esc(title(selected))}</h2><p>Para ${portions} persona${portions===1?'':'s'}. Cantidades orientativas por ración adulta; pesos de proteína en crudo y atún escurrido.</p>${report.missing.length?'<p class="recipe-warning">Esta receta requiere ingredientes agotados o no registrados. Revisa la lista antes de cocinar.</p>':''}<h3>Ingredientes</h3><ul>${report.items.map(i=>`<li>${fmt(i.quantity*portions)} ${esc(i.unit)} de ${esc(stock(i)?.name||i.name)} <span class="meta">(${esc(statusText(i))})</span></li>`).join('')}</ul><p>Agua potable para las cocciones cuando se indique. El aceite indicado es para toda la preparación; repártelo entre verduras y proteína. No se presupone sal ni otros condimentos.</p><h3>Preparación</h3><ol><li>${esc(s.cook)}</li><li>${esc(selected.cook)}</li><li>${esc(p.cook)} Usa otra sartén si necesitas reservar la salsa o las verduras.</li><li>Mezcla la proteína ya cocida con la salsa o verduras. Sirve con el acompañante preparado, repartiendo en ${portions} porciones.</li></ol><p>Comprueba las cantidades reales: “Hay suficiente” no mide gramos ni unidades. Cocinar esta receta no cambia automáticamente tu inventario ni tus compras.</p></article>`;
}
function reset(){submitted=false;selected=null;portions=null;$('#recipeMenus').innerHTML='';$('#recipeDetail').innerHTML='';$('#recipePeoplePanel').classList.add('hidden')}
$('#recipePreferences').onsubmit=e=>{e.preventDefault();submitted=true;selected=null;portions=null;$('#recipePeoplePanel').classList.add('hidden');$('#recipeDetail').innerHTML='';showMenus()};
for(const id of ['recipeMeal','recipeProtein','recipeSide'])$('#'+id).onchange=reset;
$('#recipePeopleForm').onsubmit=e=>{e.preventDefault();const n=Number($('#recipePeople').value);if(!Number.isInteger(n)||n<1||n>20)return;portions=n;showRecipe();$('#recipeDetail').scrollIntoView({behavior:'smooth',block:'start'})};
window.refreshRecipes=()=>{updateOverview();if(submitted){showMenus();showRecipe()}};
updateOverview();
})();
