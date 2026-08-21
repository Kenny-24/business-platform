<template>
  <div class="dashboard" v-loading="loading">
    <div class="dashboard-head"><div><span>LIVE OVERVIEW</span><h2>今日经营概览</h2><p>数据来自鲜果铺 API 与 PostgreSQL</p></div><el-button @click="load">刷新数据</el-button></div>
    <div class="metrics">
      <div class="metric" v-for="metric in metrics" :key="metric.label">
        <span>{{ metric.label }}</span><b>{{ metric.prefix }}{{ metric.value }}</b><small>{{ metric.desc }}</small>
      </div>
    </div>
    <div class="panel notes">
      <div class="notes-head"><div><span>OPERATION PRINCIPLES</span><h3>鲜果铺运营重点</h3></div><div class="status-dot"><i />系统规则已启用</div></div>
      <div class="notes-grid">
        <div><em>01</em><b>单位与规格</b><p>每个 SKU 独立设置购买单位、规格、最小购买量与步进，避免所有水果统一按“斤”售卖。</p></div>
        <div><em>02</em><b>全国化商品</b><p>商品按品类、品种和产地管理，不绑定城市，配送范围交给后续运费模板和仓配系统。</p></div>
        <div><em>03</em><b>库存安全</b><p>订单在数据库事务内扣库存，取消订单自动回补；状态流转由服务端校验，避免重复处理。</p></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const data=ref<any>({});
const loading=ref(false);
const metrics=computed(()=>[
  {label:'商品总数',value:data.value.products||0,prefix:'',desc:`在售 ${data.value.onSale||0}`},
  {label:'累计订单',value:data.value.orders||0,prefix:'',desc:`待处理 ${data.value.pending||0}`},
  {label:'用户数',value:data.value.users||0,prefix:'',desc:'微信用户'},
  {label:'累计 GMV',value:Number(data.value.gmV||0).toFixed(2),prefix:'¥',desc:'已支付口径'}
]);
async function load(){ loading.value=true; try{ data.value=await api.get('/admin/dashboard'); }catch(error:any){ ElMessage.error(error.response?.data?.message||'经营数据加载失败'); }finally{ loading.value=false; } }
onMounted(load);
</script>

<style scoped>
.dashboard-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px}.dashboard-head span,.notes-head span{color:#779082;font-size:10px;letter-spacing:2.5px}.dashboard-head h2{margin:7px 0 0;font-size:22px}.dashboard-head p{margin:7px 0 0;color:#969d98;font-size:12px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}.metric{position:relative;overflow:hidden;padding:23px;border:1px solid #e7e4da;border-radius:17px;background:#fffdf8}.metric:after{content:"";position:absolute;width:90px;height:90px;right:-36px;top:-36px;border-radius:50%;background:#e5eee5}.metric span,.metric small{display:block}.metric span{font-size:12px;color:#89928c}.metric b{display:block;margin:13px 0 8px;font-size:30px;letter-spacing:-.5px}.metric small{font-size:11px;color:#adb3ae}.notes-head{display:flex;align-items:center;justify-content:space-between}.notes h3{margin:6px 0 0}.status-dot{font-size:11px;color:#718078}.status-dot i{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#75a37d}.notes-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:17px;margin-top:20px}.notes-grid>div{position:relative;padding:19px;border:1px solid #e9e7de;border-radius:13px;background:#f7f7f2}.notes-grid em{position:absolute;right:15px;top:13px;color:#c4cec5;font-size:20px;font-style:normal;font-weight:300}.notes-grid b{font-size:14px}.notes-grid p{margin:10px 0 0;color:#77817a;font-size:12px;line-height:1.75}@media(max-width:1200px){.metrics{grid-template-columns:repeat(2,1fr)}}
</style>
