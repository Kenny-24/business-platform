<template>
  <div class="panel">
    <div class="toolbar">
      <el-input v-model="query.keyword" clearable placeholder="搜索水果 / 产地 / 品种" style="width:260px" @keyup.enter="load" />
      <el-select v-model="query.status" clearable placeholder="状态" style="width:130px">
        <el-option label="在售" value="ON_SALE" />
        <el-option label="下架" value="OFF_SALE" />
        <el-option label="草稿" value="DRAFT" />
      </el-select>
      <el-button @click="load">查询</el-button>
      <div class="spacer" />
      <el-button type="primary" @click="edit()">新增商品</el-button>
    </div>

    <el-table v-loading="loading" :data="items">
      <el-table-column label="商品" min-width="240">
        <template #default="s">
          <div class="product-cell">
            <el-image :src="s.row.imageUrl" class="thumb" fit="cover" />
            <div><b>{{ s.row.name }}</b><div class="muted cell-sub">{{ s.row.origin }} · {{ s.row.variety }}</div></div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="category.name" label="分类" width="120" />
      <el-table-column label="起售价 / 单位" width="150">
        <template #default="s"><span v-if="s.row.skus[0]">¥{{ s.row.skus[0].price }} / {{ s.row.skus[0].unitName }}</span></template>
      </el-table-column>
      <el-table-column label="规格" width="170"><template #default="s">{{ s.row.skus[0]?.specText }}</template></el-table-column>
      <el-table-column label="SKU" width="70"><template #default="s">{{ s.row.skus.length }}</template></el-table-column>
      <el-table-column label="状态" width="90"><template #default="s"><el-tag :type="s.row.status === 'ON_SALE' ? 'success' : 'info'">{{ statusText[s.row.status] }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="150"><template #default="s"><el-button link type="primary" @click="edit(s.row)">编辑</el-button><el-button v-if="s.row.status==='ON_SALE'" link type="danger" @click="archive(s.row)">下架</el-button></template></el-table-column>
    </el-table>

    <div class="pager"><el-pagination background layout="prev,pager,next,total" :total="total" :page-size="query.pageSize" v-model:current-page="query.page" @current-change="load" /></div>
  </div>

  <el-dialog v-model="visible" :title="form.id ? '编辑商品' : '新增商品'" width="1060px" top="3vh">
    <el-form label-position="top">
      <div class="two">
        <el-form-item label="商品名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类"><el-select v-model="form.categoryId" style="width:100%"><el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" /></el-select></el-form-item>
        <el-form-item label="品种"><el-input v-model="form.variety" placeholder="例如 红颜 / 金枕 / 红富士" /></el-form-item>
        <el-form-item label="产地"><el-input v-model="form.origin" placeholder="例如 辽宁丹东 / 泰国" /></el-form-item>
        <el-form-item label="副标题"><el-input v-model="form.subtitle" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="在售" value="ON_SALE" /><el-option label="下架" value="OFF_SALE" /><el-option label="草稿" value="DRAFT" /></el-select></el-form-item>
      </div>

      <el-form-item label="商品图片">
        <div class="upload-row">
          <el-image v-if="form.imageUrl" :src="form.imageUrl" class="preview" fit="cover" />
          <el-input v-model="form.imageUrl" placeholder="上传后自动生成，也可以填写 CDN 图片 URL" />
          <el-upload :show-file-list="false" :http-request="uploadImage" accept="image/png,image/jpeg,image/webp"><el-button>上传图片</el-button></el-upload>
        </div>
      </el-form-item>

      <div class="two compact">
        <el-form-item label="首页精选"><el-switch v-model="form.featured" /></el-form-item>
        <el-form-item label="商品排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
      </div>
      <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>

      <div class="sku-head"><div><b>购买规格 / SKU</b><p>每个规格独立定义购买单位、价格、库存、起购数量与增减步长。</p></div><el-button size="small" @click="addSku">＋ 增加规格</el-button></div>
      <div v-for="(s, i) in form.skus" :key="i" class="sku-card">
        <div class="sku-title"><b>规格 {{ i + 1 }}</b><el-button v-if="form.skus.length > 1" text type="danger" @click="form.skus.splice(i, 1)">删除</el-button></div>
        <div class="sku-grid">
          <label>SKU 名<el-input v-model="s.name" placeholder="家庭装" /></label>
          <label>规格文案<el-input v-model="s.specText" placeholder="500g/盒" /></label>
          <label>购买单位<el-select v-model="s.unitName" style="width:100%"><el-option v-for="u in units" :key="u" :label="u" :value="u" /></el-select></label>
          <label>计价方式<el-select v-model="s.pricingMode" style="width:100%"><el-option label="按份固定价" value="FIXED" /><el-option label="按重量单位" value="WEIGHT" /></el-select></label>
          <label>售价<el-input-number v-model="s.price" :min="0" :precision="2" controls-position="right" style="width:100%" /></label>
          <label>划线价<el-input-number v-model="s.marketPrice" :min="0" :precision="2" controls-position="right" style="width:100%" /></label>
          <label>库存（购买单位）<el-input-number v-model="s.stock" :min="0" :precision="3" controls-position="right" style="width:100%" /></label>
          <label>最小购买数<el-input-number v-model="s.minPurchase" :min="0.001" :precision="3" controls-position="right" style="width:100%" /></label>
          <label>数量步长<el-input-number v-model="s.step" :min="0.001" :precision="3" controls-position="right" style="width:100%" /></label>
          <label>启用<el-switch v-model="s.enabled" /></label>
        </div>
      </div>
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存商品</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { ElMessage, ElMessageBox } from 'element-plus';

const units = ['斤','公斤','克','个','盒','袋','箱','提','板','筐','把'];
const statusText: Record<string,string> = { ON_SALE:'在售', OFF_SALE:'下架', DRAFT:'草稿' };
const items = ref<any[]>([]); const categories = ref<any[]>([]); const total = ref(0); const visible = ref(false); const loading=ref(false); const saving=ref(false);
const query = reactive({ keyword:'', status:'', page:1, pageSize:20 });
const newSku = () => ({ name:'标准装', specText:'500g/盒', unitName:'盒', pricingMode:'FIXED', price:19.9, marketPrice:22.9, stock:100, minPurchase:1, step:1, enabled:true, sort:0 });
const blank = () => ({ id:0, name:'', subtitle:'', origin:'', variety:'', description:'', imageUrl:'', categoryId:0, status:'ON_SALE', featured:false, sort:0, skus:[newSku()] });
const form = reactive<any>(blank());

async function load(){ loading.value=true; try{ const d:any = await api.get('/admin/products',{params:query}); items.value=d.items; total.value=d.total; }catch(e:any){ ElMessage.error(e.response?.data?.message||'商品加载失败'); }finally{ loading.value=false; } }
async function loadCats(){ try{ categories.value = await api.get('/admin/categories'); }catch(e:any){ ElMessage.error(e.response?.data?.message||'分类加载失败'); } }
function edit(row?:any){ Object.assign(form,row?JSON.parse(JSON.stringify(row)):blank()); if(!form.categoryId&&categories.value[0]) form.categoryId=categories.value[0].id; visible.value=true; }
function addSku(){ form.skus.push(newSku()); }
async function uploadImage(o:any){ try{ const fd=new FormData(); fd.append('file',o.file); const d:any=await api.post('/admin/upload',fd); form.imageUrl=d.url; ElMessage.success('图片已上传'); }catch(e:any){ ElMessage.error(e.response?.data?.message||'上传失败'); } }
async function save(){
  if(!form.name || !form.categoryId || !form.skus.length) return ElMessage.warning('请填写商品名称、分类和至少一个规格');
  const payload=JSON.parse(JSON.stringify(form)); delete payload.id; delete payload.category; delete payload.createdAt; delete payload.updatedAt;
  payload.skus=payload.skus.map((s:any)=>{ const {productId,createdAt,updatedAt,...x}=s; return x; });
  saving.value=true;
  try{ form.id ? await api.put(`/admin/products/${form.id}`,payload) : await api.post('/admin/products',payload); visible.value=false; ElMessage.success('商品已保存'); load(); }
  catch(e:any){ ElMessage.error(e.response?.data?.message||'商品保存失败'); }
  finally{ saving.value=false; }
}
async function archive(row:any){ try{ await ElMessageBox.confirm(`下架“${row.name}”？商品与规格会停用，历史订单仍会保留。`,'确认下架'); await api.delete(`/admin/products/${row.id}`); ElMessage.success('商品已下架'); load(); }catch(e:any){ if(e!=='cancel'&&e!=='close') ElMessage.error(e.response?.data?.message||'下架失败'); } }
onMounted(()=>{ load(); loadCats(); });
</script>

<style scoped>
.product-cell{display:flex;align-items:center;gap:12px}.thumb{width:52px;height:52px;border-radius:9px;background:#eef1ed}.cell-sub{font-size:11px;margin-top:5px}.pager{display:flex;justify-content:flex-end;margin-top:18px}.two{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.two.compact{grid-template-columns:180px 220px}.upload-row{display:flex;align-items:center;gap:12px;width:100%}.preview{width:66px;height:66px;border-radius:10px;background:#eef1ed;flex:none}.sku-head{display:flex;align-items:center;justify-content:space-between;margin:8px 0 12px}.sku-head p{margin:5px 0 0;color:#89928c;font-size:12px}.sku-card{background:#f7f9f6;border:1px solid #e5ebe5;border-radius:12px;padding:15px;margin-bottom:12px}.sku-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.sku-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.sku-grid label{font-size:11px;color:#737c76}.sku-grid label>*{margin-top:6px}
</style>
