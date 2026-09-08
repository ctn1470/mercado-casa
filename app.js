
const cfg=window.MERCADO_CONFIG||{};
const configured=cfg.supabaseUrl&&!cfg.supabaseUrl.includes("PEGA_AQUI")&&cfg.supabaseAnonKey&&!cfg.supabaseAnonKey.includes("PEGA_AQUI");
if(!configured){document.body.innerHTML='<div style="font-family:sans-serif;padding:40px;max-width:700px;margin:auto"><h1>Falta conectar Supabase</h1><p>Abre <b>config.js</b> y pega tu Project URL y tu anon key. Sigue la guía README.</p></div>';throw new Error("Supabase no configurado")}
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let state={products:[],stores:[],categories:[],lowProduct:null};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const userName=()=>localStorage.getItem("mercado_user")||"";
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
function storeNames(p){return(p.product_stores||[]).map(x=>x.stores?.name).filter(Boolean).sort()}
function activeShop(p){return p.shopping_list?.find(x=>x.active)}
function isInShopping(p){return!!activeShop(p)}
async function loadAll(){
 const [{data:stores,error:se},{data:cats,error:ce},{data:products,error:pe}]=await Promise.all([
  sb.from("stores").select("*").order("name"),sb.from("categories").select("*").order("name"),
  sb.from("products").select("*, product_stores(store_id,stores(id,name)), shopping_list(id,priority,active)").order("name")]);
 if(se||ce||pe){console.error(se||ce||pe);toast("No se pudo cargar la información");return}
 state.stores=stores;state.categories=cats;state.products=products;renderAll()
}
function renderAll(){renderFilters();renderInventory();renderShopping();renderStores();renderProductStoreChecks();$("#userBtn").textContent=userName()?userName()+" ▾":"Usuario"}
function renderFilters(){
 const currentCat=$("#categoryFilter").value,currentStore=$("#storeFilter").value;
 $("#categoryFilter").innerHTML='<option value="">Todas las categorías</option>'+state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 $("#storeFilter").innerHTML='<option value="">Todas las tiendas</option>'+state.stores.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
 $("#productCategory").innerHTML=state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 $("#categoryFilter").value=currentCat;$("#storeFilter").value=currentStore
}
function renderProductStoreChecks(selected=[]){$("#productStores").innerHTML=state.stores.map(s=>`<label><input type="checkbox" value="${s.id}" ${selected.includes(s.id)?"checked":""}/> ${esc(s.name)}</label>`).join("")}
function renderInventory(){
 const q=$("#searchInput").value.toLowerCase().trim(),cat=$("#categoryFilter").value;
 const filtered=state.products.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(!cat||p.category_id===cat));
 $("#inventoryList").innerHTML=filtered.length?filtered.map(p=>{
  const st=storeNames(p),catName=state.categories.find(c=>c.id===p.category_id)?.name||"";
  return `<article class="product-card"><div class="product-top"><div><div class="product-name">${esc(p.name)}</div><div class="meta">${esc(catName)} · Último cambio: ${esc(p.updated_by||"—")}</div></div><button class="edit" onclick="openEditProduct('${p.id}')">Editar</button></div>
  <div class="store-tags">${st.length?st.map(x=>`<span class="tag">${esc(x)}</span>`).join(""):'<span class="meta">Sin tienda asignada</span>'}</div>
  <div class="statuses"><button class="status-btn out ${p.status==="out"?"active":""}" onclick="setStatus('${p.id}','out')">Se acabó</button><button class="status-btn low ${p.status==="low"?"active":""}" onclick="setStatus('${p.id}','low')">Queda poco</button><button class="status-btn enough ${p.status==="enough"?"active":""}" onclick="setStatus('${p.id}','enough')">Hay suficiente</button></div></article>`
 }).join(""):'<div class="empty">No hay productos con estos filtros.</div>';
 const counts={enough:0,low:0,out:0,buy:0};state.products.forEach(p=>{counts[p.status]++;if(isInShopping(p))counts.buy++});
 $("#countEnough").textContent=counts.enough;$("#countLow").textContent=counts.low;$("#countOut").textContent=counts.out;$("#countBuy").textContent=counts.buy;$("#shoppingBadge").textContent=counts.buy
}
function renderShopping(){
 const sf=$("#storeFilter").value;
 const rows=state.products.filter(p=>{const a=activeShop(p);if(!a)return false;if(!sf)return true;return(p.product_stores||[]).some(x=>x.store_id===sf)});
 const high=rows.filter(p=>activeShop(p).priority==="high"),med=rows.filter(p=>activeShop(p).priority==="medium");
 $("#highCount").textContent=high.length;$("#mediumCount").textContent=med.length;
 const html=arr=>arr.length?arr.map(p=>`<div class="shop-row"><div><div class="shop-name">${esc(p.name)}</div><div class="shop-meta">${storeNames(p).map(esc).join(" · ")||"Sin tienda asignada"}</div></div><button class="primary bought" onclick="markBought('${p.id}')">✓ Comprado</button></div>`).join(""):'<div class="empty">No hay productos.</div>';
 $("#highList").innerHTML=html(high);$("#mediumList").innerHTML=html(med)
}
function renderStores(){$("#storesList").innerHTML=state.stores.map(s=>{const n=state.products.filter(p=>(p.product_stores||[]).some(x=>x.store_id===s.id)).length;return`<div class="store-row"><strong>${esc(s.name)}</strong><span class="meta">${n} producto${n===1?"":"s"}</span></div>`}).join("")}
async function upsertShopping(productId,priority,active=true){
 const existing=state.products.find(p=>p.id===productId)?.shopping_list?.find(x=>x.active);
 if(existing)return sb.from("shopping_list").update({priority,active,added_by:userName()}).eq("id",existing.id);
 return sb.from("shopping_list").insert({product_id:productId,priority,active,added_by:userName()})
}
async function setStatus(id,status){
 if(status==="low"){state.lowProduct=id;$("#lowDialog").showModal();return}
 const {error}=await sb.from("products").update({status,updated_by:userName()}).eq("id",id);if(error)return toast("No se pudo actualizar");
 if(status==="out"){await upsertShopping(id,"high",true);toast("Agregado a compras · prioridad alta")}
 else{await sb.from("shopping_list").update({active:false,bought_by:userName(),bought_at:new Date().toISOString()}).eq("product_id",id).eq("active",true);toast("Marcado como hay suficiente")}
 await loadAll()
}
async function markBought(id){
 const {error}=await sb.from("products").update({status:"enough",updated_by:userName()}).eq("id",id);if(error)return toast("No se pudo actualizar");
 await sb.from("shopping_list").update({active:false,bought_by:userName(),bought_at:new Date().toISOString()}).eq("product_id",id).eq("active",true);
 toast("Compra registrada");await loadAll()
}
function openEditProduct(id){
 const p=state.products.find(x=>x.id===id);if(!p)return;$("#productDialogTitle").textContent="Editar producto";$("#productId").value=p.id;$("#productName").value=p.name;$("#productCategory").value=p.category_id;
 renderProductStoreChecks((p.product_stores||[]).map(x=>x.store_id));$("#productDialog").showModal()
}
$("#newProductBtn").onclick=()=>{$("#productDialogTitle").textContent="Nuevo producto";$("#productId").value="";$("#productName").value="";$("#productCategory").value=state.categories[0]?.id||"";renderProductStoreChecks([]);$("#productDialog").showModal()}
$("#productForm").addEventListener("submit",async e=>{
 e.preventDefault();const id=$("#productId").value,name=$("#productName").value.trim(),category_id=$("#productCategory").value,selected=$$("#productStores input:checked").map(x=>x.value);if(!name)return;
 let pid=id;if(id){const{error}=await sb.from("products").update({name,category_id,updated_by:userName()}).eq("id",id);if(error)return toast("No se pudo guardar");await sb.from("product_stores").delete().eq("product_id",id)}
 else{const{data,error}=await sb.from("products").insert({name,category_id,status:"enough",updated_by:userName()}).select().single();if(error)return toast("No se pudo crear");pid=data.id}
 if(selected.length)await sb.from("product_stores").insert(selected.map(store_id=>({product_id:pid,store_id})));
 $("#productDialog").close();toast("Producto guardado");await loadAll()
});
$("#lowYes").onclick=async e=>{e.preventDefault();const id=state.lowProduct;if(!id)return;await sb.from("products").update({status:"low",updated_by:userName()}).eq("id",id);await upsertShopping(id,"medium",true);$("#lowDialog").close();state.lowProduct=null;toast("Agregado a compras · prioridad media");await loadAll()};
$("#lowNo").onclick=async e=>{e.preventDefault();const id=state.lowProduct;if(!id)return;await sb.from("products").update({status:"low",updated_by:userName()}).eq("id",id);$("#lowDialog").close();state.lowProduct=null;toast("Estado actualizado");await loadAll()};
$("#newStoreBtn").onclick=()=>{$("#storeName").value="";$("#storeDialog").showModal()}
$("#storeForm").addEventListener("submit",async e=>{e.preventDefault();const name=$("#storeName").value.trim();if(!name)return;const{error}=await sb.from("stores").insert({name});if(error)return toast(error.code==="23505"?"La tienda ya existe":"No se pudo crear");$("#storeDialog").close();toast("Tienda creada");await loadAll()});
$$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(x=>x.classList.remove("active"));$("#"+b.dataset.view+"View").classList.add("active")});
$("#searchInput").oninput=renderInventory;$("#categoryFilter").onchange=renderInventory;$("#storeFilter").onchange=renderShopping;
$("#userBtn").onclick=()=>{$("#nameInput").value=userName();$("#nameDialog").showModal()}
$("#nameForm").addEventListener("submit",e=>{e.preventDefault();const n=$("#nameInput").value.trim();if(!n)return;localStorage.setItem("mercado_user",n);$("#nameDialog").close();renderAll()});
if(!userName())$("#nameDialog").showModal();
loadAll();
