const cfg=window.MERCADO_CONFIG||{};
const configured=cfg.supabaseUrl&&!cfg.supabaseUrl.includes("PEGA_AQUI")&&cfg.supabaseAnonKey&&!cfg.supabaseAnonKey.includes("PEGA_AQUI");
if(!configured){document.body.innerHTML='<div style="font-family:sans-serif;padding:40px;max-width:700px;margin:auto"><h1>Falta conectar Supabase</h1><p>Revisa config.js.</p></div>';throw new Error("Supabase no configurado")}
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let state={products:[],stores:[],categories:[],lowProduct:null,statusFilter:"",showArchived:false};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const userName=()=>localStorage.getItem("mercado_user")||"";
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1900)}
function storeNames(p){return(p.product_stores||[]).map(x=>x.stores?.name).filter(Boolean).sort()}
function activeShop(p){return p.shopping_list?.find(x=>x.active)}
function isInShopping(p){return!!activeShop(p)}
function activeProducts(){return state.products.filter(p=>!p.archived)}
async function loadAll(){
 const [{data:stores,error:se},{data:cats,error:ce},{data:products,error:pe}]=await Promise.all([
  sb.from("stores").select("*").order("name"),sb.from("categories").select("*").order("name"),
  sb.from("products").select("*, product_stores(store_id,stores(id,name)), shopping_list(id,priority,active)").order("name")]);
 if(se||ce||pe){console.error(se||ce||pe);toast("No se pudo cargar la información");return}
 state.stores=stores||[];state.categories=cats||[];state.products=products||[];renderAll()
}
function renderAll(){renderFilters();renderInventory();renderShopping();renderStores();renderCategories();renderArchived();renderCatalog();renderProductStoreChecks();$("#userBtn").textContent=userName()?userName()+" ▾":"Usuario"}
function renderFilters(){
 const currentCat=$("#categoryFilter").value,currentStore=$("#storeFilter").value,currentInventoryStore=$("#inventoryStoreFilter").value;
 $("#categoryFilter").innerHTML='<option value="">Todas las categorías</option>'+state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 $("#storeFilter").innerHTML='<option value="">Todas las tiendas</option>'+state.stores.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
 $("#inventoryStoreFilter").innerHTML=$("#storeFilter").innerHTML;
 $("#inventoryStoreFilter").value=state.stores.some(s=>s.id===currentInventoryStore)?currentInventoryStore:"";
 $("#productCategory").innerHTML=state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 $("#categoryFilter").value=currentCat;$("#storeFilter").value=currentStore
}
function renderProductStoreChecks(selected=[]){$("#productStores").innerHTML=state.stores.map(s=>`<label><input type="checkbox" value="${s.id}" ${selected.includes(s.id)?"checked":""}/> ${esc(s.name)}</label>`).join("")}
function productCard(p){
 if(p.archived)return `<article class="product-card"><div class="product-name">${esc(p.name)}</div><div class="meta">${esc(state.categories.find(c=>c.id===p.category_id)?.name||"")}</div><div class="store-tags"><span class="tag">Archivado</span><span class="tag">${esc({enough:"Hay suficiente",low:"Queda poco",out:"Se acabó"}[p.status]||p.status)}</span>${storeNames(p).map(s=>`<span class="tag">${esc(s)}</span>`).join("")}</div><div class="row-actions"><button class="ghost" onclick="restoreProduct('${p.id}')">Reactivar</button><button class="danger-btn" onclick="openDeleteProduct('${p.id}')">Eliminar definitivamente</button></div></article>`;

 const st=storeNames(p),catName=state.categories.find(c=>c.id===p.category_id)?.name||"";const optional=p.replenishment_type==="optional";
 return `<article class="product-card"><div class="product-top"><div><div class="product-name">${esc(p.name)}</div><div class="meta">${esc(catName)} · Último cambio: ${esc(p.updated_by||"—")}</div></div><button class="edit" onclick="openEditProduct('${p.id}')">Editar</button></div><div class="store-tags"><span class="mode-tag ${optional?"optional":""}">${optional?"Reposición opcional":"Reposición automática"}</span>${st.length?st.map(x=>`<span class="tag">${esc(x)}</span>`).join(""):'<span class="meta">Sin tienda asignada</span>'}</div><div class="statuses"><button class="status-btn out ${p.status==="out"?"active":""}" onclick="setStatus('${p.id}','out')">Se acabó</button><button class="status-btn low ${p.status==="low"?"active":""}" onclick="setStatus('${p.id}','low')">Queda poco</button><button class="status-btn enough ${p.status==="enough"?"active":""}" onclick="setStatus('${p.id}','enough')">Hay suficiente</button></div>${optional&&!isInShopping(p)?`<button class="manual-buy" onclick="addManualShopping('${p.id}')">+ Agregar a compras</button>`:""}</article>`
}
function renderInventory(){
 const q=$("#searchInput").value.toLowerCase().trim(),cat=$("#categoryFilter").value,status=state.statusFilter,store=$("#inventoryStoreFilter").value;
 $("#clearSearch").classList.toggle("hidden",!$("#searchInput").value);
 const products=state.products.filter(p=>!!p.archived===state.showArchived);
 $("#productsHeading").textContent=state.showArchived?"Productos archivados":"Productos";
 $("#toggleArchived").textContent=state.showArchived?"Volver a productos":`Archivados (${state.products.filter(p=>p.archived).length})`;
 $("#toggleArchived").setAttribute("aria-pressed",String(state.showArchived));
 $("#newProductBtn").classList.toggle("hidden",state.showArchived);
 const filtered=products.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(!cat||p.category_id===cat)&&(!status||p.status===status)&&(!store||(p.product_stores||[]).some(s=>s.store_id===store)));
 $("#inventoryList").innerHTML=filtered.length?filtered.map(productCard).join(""):'<div class="empty">No hay productos con estos filtros.</div>';
 const counts={enough:0,low:0,out:0,buy:0};products.forEach(p=>{counts[p.status]=(counts[p.status]||0)+1;if(!p.archived&&isInShopping(p))counts.buy++});
 counts.buy=activeProducts().filter(isInShopping).length;
 $("#countEnough").textContent=counts.enough;$("#countLow").textContent=counts.low;$("#countOut").textContent=counts.out;$("#countBuy").textContent=counts.buy;$("#shoppingBadge").textContent=counts.buy;
 $$(".summary[data-status]").forEach(card=>card.classList.toggle("active",card.dataset.status===status));
 $("#clearStatusFilter").classList.toggle("hidden",!status)
}
function renderShopping(){
 const sf=$("#storeFilter").value;const rows=activeProducts().filter(p=>{const a=activeShop(p);if(!a)return false;if(!sf)return true;return(p.product_stores||[]).some(x=>x.store_id===sf)});
 const high=rows.filter(p=>activeShop(p).priority==="high"),med=rows.filter(p=>activeShop(p).priority==="medium");$("#highCount").textContent=high.length;$("#mediumCount").textContent=med.length;
 const html=arr=>arr.length?arr.map(p=>`<div class="shop-row"><div><div class="shop-name">${esc(p.name)}</div><div class="shop-meta">${storeNames(p).map(esc).join(" · ")||"Sin tienda asignada"}</div></div><button class="primary bought" onclick="markBought('${p.id}')">✓ Comprado</button></div>`).join(""):'<div class="empty">No hay productos.</div>';
 $("#highList").innerHTML=html(high);$("#mediumList").innerHTML=html(med)
}
function renderStores(){$("#storesList").innerHTML=state.stores.map(s=>{const n=activeProducts().filter(p=>(p.product_stores||[]).some(x=>x.store_id===s.id)).length;return`<div class="store-row"><div><strong>${esc(s.name)}</strong><div class="meta">${n} producto${n===1?"":"s"}</div></div><div class="row-actions"><button class="ghost small" onclick="editStore('${s.id}')">Editar</button><button class="danger-btn small" onclick="deleteStore('${s.id}')">Eliminar</button></div></div>`}).join("")}
function renderCategories(){$("#categoriesList").innerHTML=state.categories.map(c=>{const n=activeProducts().filter(p=>p.category_id===c.id).length;return`<div class="store-row"><div><strong>${esc(c.name)}</strong><div class="meta">${n} producto${n===1?"":"s"}</div></div><div class="row-actions"><button class="ghost small" onclick="editCategory('${c.id}')">Editar</button><button class="danger-btn small" onclick="deleteCategory('${c.id}')">Eliminar</button></div></div>`}).join("")}
function renderArchived(){const arr=state.products.filter(p=>p.archived);$("#archivedBadge").textContent=arr.length;$("#archivedList").innerHTML=arr.length?arr.map(p=>`<article class="product-card"><div class="product-top"><div><div class="product-name">${esc(p.name)}</div><div class="meta">Archivado</div></div><button class="primary" onclick="restoreProduct('${p.id}')">Reactivar</button></div></article>`).join(""):'<div class="empty">No hay productos archivados.</div>'}
async function upsertShopping(productId,priority,active=true){const existing=state.products.find(p=>p.id===productId)?.shopping_list?.find(x=>x.active);if(existing)return sb.from("shopping_list").update({priority,active,added_by:userName()}).eq("id",existing.id);return sb.from("shopping_list").insert({product_id:productId,priority,active,added_by:userName()})}
async function setStatus(id,status){
 const p=state.products.find(x=>x.id===id);if(!p)return;
 if(status==="low"&&p.replenishment_type!=="optional"){state.lowProduct=id;$("#lowDialog").showModal();return}
 const {error}=await sb.from("products").update({status,updated_by:userName()}).eq("id",id);if(error)return toast("No se pudo actualizar");
 if(status==="out"&&p.replenishment_type!=="optional"){await upsertShopping(id,"high",true);toast("Agregado a compras · prioridad alta")}
 else if(status==="enough"){await sb.from("shopping_list").update({active:false,bought_by:userName(),bought_at:new Date().toISOString()}).eq("product_id",id).eq("active",true);toast("Marcado como hay suficiente")}
 else toast("Estado actualizado");await loadAll()
}
async function addManualShopping(id){const p=state.products.find(x=>x.id===id);if(!p)return;const priority=p.status==="out"?"high":"medium";const {error}=await upsertShopping(id,priority,true);if(error)return toast("No se pudo agregar");toast("Agregado a compras");await loadAll()}
async function markBought(id){const {error}=await sb.from("products").update({status:"enough",updated_by:userName()}).eq("id",id);if(error)return toast("No se pudo actualizar");await sb.from("shopping_list").update({active:false,bought_by:userName(),bought_at:new Date().toISOString()}).eq("product_id",id).eq("active",true);toast("Compra registrada");await loadAll()}
function openEditProduct(id){const p=state.products.find(x=>x.id===id);if(!p)return;$("#productDialogTitle").textContent="Editar producto";$("#productId").value=p.id;$("#productName").value=p.name;$("#productCategory").value=p.category_id;$("#productReplenishment").value=p.replenishment_type||"automatic";renderProductStoreChecks((p.product_stores||[]).map(x=>x.store_id));$("#archiveArea").classList.remove("hidden");$("#productDialog").showModal()}
$("#newProductBtn").onclick=()=>{$("#productDialogTitle").textContent="Nuevo producto";$("#productId").value="";$("#productName").value="";$("#productCategory").value=state.categories[0]?.id||"";$("#productReplenishment").value="automatic";renderProductStoreChecks([]);$("#archiveArea").classList.add("hidden");$("#productDialog").showModal()};
$("#productForm").addEventListener("submit",async e=>{e.preventDefault();const id=$("#productId").value,name=$("#productName").value.trim(),category_id=$("#productCategory").value,replenishment_type=$("#productReplenishment").value,selected=$$("#productStores input:checked").map(x=>x.value);if(!name)return;let pid=id;if(id){const{error}=await sb.from("products").update({name,category_id,replenishment_type,updated_by:userName()}).eq("id",id);if(error)return toast(error.code==="23505"?"Ya existe un producto con ese nombre":"No se pudo guardar");await sb.from("product_stores").delete().eq("product_id",id)}else{const{data,error}=await sb.from("products").insert({name,category_id,status:"enough",replenishment_type,archived:false,updated_by:userName()}).select().single();if(error)return toast(error.code==="23505"?"Ya existe un producto con ese nombre":"No se pudo crear");pid=data.id}if(selected.length)await sb.from("product_stores").insert(selected.map(store_id=>({product_id:pid,store_id})));$("#productDialog").close();toast("Producto guardado");await loadAll()});
$("#archiveProductBtn").onclick=async()=>{const id=$("#productId").value;if(!id||!confirm("¿Archivar este producto? Dejará de aparecer en Inventario y Compras."))return;await sb.from("shopping_list").update({active:false}).eq("product_id",id).eq("active",true);const{error}=await sb.from("products").update({archived:true,archived_at:new Date().toISOString(),updated_by:userName()}).eq("id",id);if(error)return toast("No se pudo archivar");$("#productDialog").close();toast("Producto archivado");await loadAll()};
async function restoreProduct(id){const{error}=await sb.from("products").update({archived:false,archived_at:null,updated_by:userName()}).eq("id",id);if(error)return toast("No se pudo reactivar");toast("Producto reactivado");await loadAll()}
$("#lowYes").onclick=async e=>{e.preventDefault();const id=state.lowProduct;if(!id)return;await sb.from("products").update({status:"low",updated_by:userName()}).eq("id",id);await upsertShopping(id,"medium",true);$("#lowDialog").close();state.lowProduct=null;toast("Agregado a compras · prioridad media");await loadAll()};
$("#lowNo").onclick=async e=>{e.preventDefault();const id=state.lowProduct;if(!id)return;await sb.from("products").update({status:"low",updated_by:userName()}).eq("id",id);$("#lowDialog").close();state.lowProduct=null;toast("Estado actualizado");await loadAll()};
$("#newStoreBtn").onclick=()=>{$("#storeDialogTitle").textContent="Nueva tienda";$("#storeId").value="";$("#storeName").value="";$("#storeDialog").showModal()};
function editStore(id){const s=state.stores.find(x=>x.id===id);if(!s)return;$("#storeDialogTitle").textContent="Editar tienda";$("#storeId").value=id;$("#storeName").value=s.name;$("#storeDialog").showModal()}
$("#storeForm").addEventListener("submit",async e=>{e.preventDefault();const id=$("#storeId").value,name=$("#storeName").value.trim();if(!name)return;const q=id?sb.from("stores").update({name}).eq("id",id):sb.from("stores").insert({name});const{error}=await q;if(error)return toast(error.code==="23505"?"La tienda ya existe":"No se pudo guardar");$("#storeDialog").close();toast("Tienda guardada");await loadAll()});
async function deleteStore(id){const n=activeProducts().filter(p=>(p.product_stores||[]).some(x=>x.store_id===id)).length;if(n>0)return toast("Primero retira esta tienda de sus productos");if(!confirm("¿Eliminar esta tienda?"))return;const{error}=await sb.from("stores").delete().eq("id",id);if(error)return toast("No se pudo eliminar");toast("Tienda eliminada");await loadAll()}
$("#newCategoryBtn").onclick=()=>{$("#categoryDialogTitle").textContent="Nueva categoría";$("#categoryId").value="";$("#categoryName").value="";$("#categoryDialog").showModal()};
function editCategory(id){const c=state.categories.find(x=>x.id===id);if(!c)return;$("#categoryDialogTitle").textContent="Editar categoría";$("#categoryId").value=id;$("#categoryName").value=c.name;$("#categoryDialog").showModal()}
$("#categoryForm").addEventListener("submit",async e=>{e.preventDefault();const id=$("#categoryId").value,name=$("#categoryName").value.trim();if(!name)return;const q=id?sb.from("categories").update({name}).eq("id",id):sb.from("categories").insert({name});const{error}=await q;if(error)return toast(error.code==="23505"?"La categoría ya existe":"No se pudo guardar");$("#categoryDialog").close();toast("Categoría guardada");await loadAll()});
async function deleteCategory(id){const n=state.products.filter(p=>p.category_id===id).length;if(n>0)return toast("Primero cambia de categoría los productos asociados");if(!confirm("¿Eliminar esta categoría?"))return;const{error}=await sb.from("categories").delete().eq("id",id);if(error)return toast("No se pudo eliminar");toast("Categoría eliminada");await loadAll()}
function showView(view){
 const tab=$(`.tab[data-view="${view}"]`);if(!tab)return;
 $$('.tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');
 $$('.view').forEach(x=>x.classList.remove('active'));$('#'+view+'View').classList.add('active')
}
function setStatusFilter(status){
 state.statusFilter=state.statusFilter===status?"":status;
 showView("inventory");renderInventory()
}
$$(".summary[data-status]").forEach(card=>card.onclick=()=>setStatusFilter(card.dataset.status));
$("#summaryBuy").onclick=()=>showView("shopping");
$("#clearStatusFilter").onclick=()=>{state.statusFilter="";renderInventory()};
$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view+'View').classList.add('active')});
$("#clearSearch").onclick=()=>{$("#searchInput").value="";renderInventory();$("#searchInput").focus()};
$("#inventoryStoreFilter").onchange=renderInventory;
$("#searchInput").oninput=renderInventory;$("#categoryFilter").onchange=renderInventory;$("#storeFilter").onchange=renderShopping;$("#userBtn").onclick=()=>{$("#nameInput").value=userName();$("#nameDialog").showModal()};
$("#nameForm").addEventListener("submit",e=>{e.preventDefault();const n=$("#nameInput").value.trim();if(!n)return;localStorage.setItem("mercado_user",n);$("#nameDialog").close();renderAll()});
function startRealtime(){let timer;const refresh=()=>{clearTimeout(timer);timer=setTimeout(loadAll,250)};sb.channel('mercado-casa-v2').on('postgres_changes',{event:'*',schema:'public',table:'products'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'shopping_list'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'product_stores'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'stores'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'categories'},refresh).subscribe()}
if(!userName())$("#nameDialog").showModal();loadAll();startRealtime();

// Complete catalog is independent of the inventory filters.
function renderCatalog(){
 const query=$("#catalogSearch").value.trim().toLowerCase();
 const products=state.products.filter(p=>!query||p.name.toLowerCase().includes(query));
 $("#clearCatalogSearch").classList.toggle("hidden",!$("#catalogSearch").value);
 $("#catalogCount").textContent=`${products.length} de ${state.products.length} productos`;
 const labels={enough:"Hay suficiente",low:"Queda poco",out:"Se acabó"};
 $("#catalogList").innerHTML=products.length?products.map(p=>`<article class="product-card"><div class="product-name">${esc(p.name)}</div><div class="meta">${esc(state.categories.find(c=>c.id===p.category_id)?.name||"Sin categoría")}</div><div class="store-tags"><span class="tag">${p.archived?"Archivado":"Activo"}</span><span class="tag">${esc(labels[p.status]||p.status)}</span>${storeNames(p).map(s=>`<span class="tag">${esc(s)}</span>`).join("")}</div><div class="row-actions">${p.archived?`<button class="ghost" onclick="restoreProduct('${p.id}')">Reactivar</button>`:`<button class="ghost" onclick="openEditProduct('${p.id}')">Editar</button>`}<button class="danger-btn" onclick="openDeleteProduct('${p.id}')">Eliminar definitivamente</button></div></article>`).join(""):'<div class="empty">No hay productos con esta búsqueda.</div>';
}
let deleteProductId=null,deleteProductBusy=false;
function openDeleteProduct(id){
 const product=state.products.find(p=>p.id===id);if(!product)return;
 deleteProductId=id;$("#deleteProductMessage").textContent=`¿Eliminar “${product.name}”?`;
 $("#deleteProductError").classList.add("hidden");
 $("#deleteProductDialog").showModal();$("#cancelDeleteProduct").focus();
}
$("#cancelDeleteProduct").onclick=()=>{if(!deleteProductBusy)$("#deleteProductDialog").close()};
$("#deleteProductDialog").addEventListener("cancel",e=>{if(deleteProductBusy)e.preventDefault()});
$("#deleteProductDialog").addEventListener("close",()=>{deleteProductId=null});
$("#deleteProductForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!deleteProductId||deleteProductBusy)return;
 const id=deleteProductId;deleteProductBusy=true;
 $("#confirmDeleteProduct").disabled=true;$("#cancelDeleteProduct").disabled=true;
 $("#deleteProductError").classList.add("hidden");
 try{
  // One database statement: constraints/cascades remain atomic. Never delete child rows separately.
  const {data,error}=await sb.from("products").delete().eq("id",id).select("id");
  if(error)throw error;
  if(!data?.length)throw new Error("No se confirmó la eliminación. Actualiza el catálogo y comprueba los permisos.");
  if(state.lowProduct===id){state.lowProduct=null;$("#lowDialog").close()}
  $("#deleteProductDialog").close();toast("Producto eliminado definitivamente");await loadAll();
 }catch(error){
  $("#deleteProductError").textContent=error.code==="23503"?"La base de datos impide eliminar este producto porque tiene registros relacionados. No se borró ningún registro. Puedes archivarlo o revisar las relaciones de la base.":error.message||"No se pudo eliminar. Comprueba la conexión y vuelve a cargar el catálogo antes de reintentar.";
  $("#deleteProductError").classList.remove("hidden");
 }finally{deleteProductBusy=false;$("#confirmDeleteProduct").disabled=false;$("#cancelDeleteProduct").disabled=false}
});
$("#catalogSearch").oninput=renderCatalog;
$("#clearCatalogSearch").onclick=()=>{$("#catalogSearch").value="";renderCatalog();$("#catalogSearch").focus()};

$("#deleteFromEdit").onclick=()=>{const id=$("#productId").value;$("#productDialog").close();openDeleteProduct(id)};

$("#toggleArchived").onclick=()=>{
 state.showArchived=!state.showArchived;
 state.statusFilter="";
 $("#searchInput").value="";$("#categoryFilter").value="";$("#inventoryStoreFilter").value="";
 renderInventory();
};
