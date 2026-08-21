<template>
  <div class="panel">
    <div class="toolbar order-toolbar">
      <el-input v-model="query.keyword" placeholder="订单号 / 收货人 / 手机号" clearable class="keyword" @keyup.enter="search" />
      <el-select v-model="query.status" clearable placeholder="全部状态" class="status-select">
        <el-option v-for="(label, key) in statusText" :key="key" :label="label" :value="key" />
      </el-select>
      <el-button @click="search">查询</el-button>
      <div class="spacer" />
      <span class="result-count">共 {{ total }} 笔订单</span>
    </div>

    <el-table v-loading="loading" :data="items" row-key="id">
      <el-table-column label="订单" min-width="210">
        <template #default="scope">
          <div class="order-heading">
            <b class="order-no">{{ scope.row.orderNo }}</b>
            <el-tag v-if="scope.row.isGift" size="small" type="warning" effect="light" class="gift-tag">礼</el-tag>
          </div>
          <div class="muted cell-sub">{{ formatTime(scope.row.createdAt) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="收货信息" min-width="170">
        <template #default="scope">
          <span>{{ scope.row.receiver }}</span>
          <div class="muted cell-sub">{{ scope.row.phone }}</div>
        </template>
      </el-table-column>
      <el-table-column label="商品摘要" min-width="260">
        <template #default="scope">
          <div v-for="goods in scope.row.items.slice(0, 2)" :key="goods.id" class="goods-line">
            {{ goods.name }} · {{ goods.specText }} × {{ goods.quantity }}
          </div>
          <div v-if="scope.row.items.length > 2" class="muted cell-sub">另有 {{ scope.row.items.length - 2 }} 种商品</div>
        </template>
      </el-table-column>
      <el-table-column label="实付" width="115">
        <template #default="scope"><b class="amount">¥{{ scope.row.totalAmount }}</b></template>
      </el-table-column>
      <el-table-column label="状态" width="115">
        <template #default="scope"><el-tag :type="statusType(scope.row.status)" effect="light">{{ statusText[scope.row.status] }}</el-tag></template>
      </el-table-column>
      <el-table-column label="履约要求" min-width="160">
        <template #default="scope">
          <div class="fulfillment-slot">{{ scope.row.deliverySlot || '未指定时段' }}</div>
          <div v-if="scope.row.isGift" class="gift-note">需礼赠包装</div>
          <div v-else class="muted cell-sub">常规包装</div>
        </template>
      </el-table-column>
      <el-table-column label="物流" min-width="150">
        <template #default="scope">
          <span v-if="scope.row.trackingNo">{{ scope.row.logisticsName }}</span>
          <div v-if="scope.row.trackingNo" class="muted cell-sub">{{ scope.row.trackingNo }}</div>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="scope"><el-button link type="primary" @click="edit(scope.row)">{{ allowedNext(scope.row.status).length ? '处理' : '查看' }}</el-button></template>
      </el-table-column>
    </el-table>

    <div class="pager"><el-pagination v-model:current-page="query.page" background layout="prev,pager,next,total" :total="total" :page-size="query.pageSize" @current-change="load" /></div>
  </div>

  <el-dialog v-model="visible" title="订单处理" width="560px">
    <div class="order-brief" v-if="current">
      <div><span>订单号</span><b>{{ current.orderNo }}</b></div>
      <div><span>当前状态</span><el-tag :type="statusType(current.status)">{{ statusText[current.status] }}</el-tag></div>
      <div><span>收货人</span><b>{{ current.receiver }} · {{ current.phone }}</b></div>
      <div><span>实付金额</span><b class="amount">¥{{ current.totalAmount }}</b></div>
      <div><span>礼赠包装</span><b :class="{ 'gift-detail': current.isGift }">{{ current.isGift ? '需要礼赠包装' : '常规包装' }}</b></div>
      <div><span>期望配送时段</span><b>{{ current.deliverySlot || '未指定' }}</b></div>
      <div class="full-width"><span>收货地址</span><b>{{ current.fullAddress }}</b></div>
      <div class="full-width"><span>用户备注</span><b>{{ current.remark || '无备注' }}</b></div>
    </div>
    <el-alert v-if="!statusOptions.length" type="info" :closable="false" title="该订单已处于终态，只能查看，不能继续变更状态。" />
    <el-form v-else label-position="top" class="status-form">
      <el-form-item label="下一状态">
        <el-select v-model="form.status" style="width:100%">
          <el-option v-for="status in statusOptions" :key="status" :label="statusText[status]" :value="status" />
        </el-select>
      </el-form-item>
      <template v-if="form.status === 'SHIPPED'">
        <el-form-item label="物流公司"><el-input v-model="form.logisticsName" placeholder="例如：顺丰速运" /></el-form-item>
        <el-form-item label="物流单号"><el-input v-model="form.trackingNo" placeholder="发货状态必须填写" /></el-form-item>
      </template>
      <el-alert v-if="form.status === 'CANCELLED'" type="warning" :closable="false" title="取消订单后，订单商品库存会自动回补。" />
    </el-form>
    <template #footer>
      <el-button @click="visible=false">关闭</el-button>
      <el-button v-if="statusOptions.length" type="primary" :loading="saving" @click="save">确认更新</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const statusText: Record<string,string> = {
  PENDING_PAYMENT:'待付款', PAID:'待发货', PREPARING:'备货中', SHIPPED:'配送中',
  COMPLETED:'已完成', CANCELLED:'已取消', REFUNDING:'退款中', REFUNDED:'已退款'
};
const transitions: Record<string,string[]> = {
  PENDING_PAYMENT:['PAID','CANCELLED'], PAID:['PREPARING','SHIPPED','CANCELLED','REFUNDING'],
  PREPARING:['SHIPPED','CANCELLED','REFUNDING'], SHIPPED:['COMPLETED','REFUNDING'],
  COMPLETED:['REFUNDING'], REFUNDING:['REFUNDED'], CANCELLED:[], REFUNDED:[]
};

const items = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const visible = ref(false);
const current = ref<any>(null);
const query = reactive({ keyword:'', status:'', page:1, pageSize:20 });
const form = reactive({ status:'', logisticsName:'', trackingNo:'' });
const statusOptions = computed(() => current.value ? allowedNext(current.value.status) : []);

function allowedNext(status:string){ return transitions[status] || []; }
function statusType(status:string):''|'success'|'warning'|'info'|'primary'|'danger'{
  if (['PAID','PREPARING'].includes(status)) return 'warning';
  if (status === 'SHIPPED') return 'primary';
  if (status === 'COMPLETED') return 'success';
  if (['CANCELLED','REFUNDED'].includes(status)) return 'info';
  if (status === 'REFUNDING') return 'danger';
  return '';
}
function formatTime(value:string){ return value ? new Date(value).toLocaleString('zh-CN',{hour12:false}) : '—'; }
async function load(){
  loading.value=true;
  try { const data:any=await api.get('/admin/orders',{params:query}); items.value=data.items; total.value=data.total; }
  catch(error:any){ ElMessage.error(error.response?.data?.message || '订单加载失败'); }
  finally { loading.value=false; }
}
function search(){ query.page=1; load(); }
function edit(row:any){
  current.value=row;
  const next=allowedNext(row.status);
  Object.assign(form,{ status:next[0] || '', logisticsName:row.logisticsName || '', trackingNo:row.trackingNo || '' });
  visible.value=true;
}
async function save(){
  if (!current.value || !form.status) return;
  if (form.status==='SHIPPED' && (!form.logisticsName.trim() || !form.trackingNo.trim())) return ElMessage.warning('请填写物流公司和物流单号');
  saving.value=true;
  try {
    await api.put(`/admin/orders/${current.value.id}/status`,form);
    visible.value=false;
    ElMessage.success('订单状态已更新');
    await load();
  } catch(error:any){ ElMessage.error(error.response?.data?.message || '更新失败'); }
  finally { saving.value=false; }
}
onMounted(load);
</script>

<style scoped>
.order-toolbar{flex-wrap:wrap}.keyword{width:270px}.status-select{width:150px}.result-count{font-size:12px;color:#707a72}.order-heading{display:flex;align-items:center;gap:8px}.order-no{font-size:13px;letter-spacing:.2px}.gift-tag{font-weight:700}.cell-sub{font-size:12px;margin-top:5px}.goods-line{font-size:12px;margin:4px 0;color:#435047}.fulfillment-slot{font-size:13px;color:#324038}.gift-note,.gift-detail{color:#c16a36;font-weight:650}.gift-note{margin-top:5px;font-size:12px}.amount{color:#d95f34}.pager{display:flex;justify-content:flex-end;margin-top:20px}.order-brief{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;padding:18px;border-radius:14px;background:#f5f6f1}.order-brief>div{display:flex;flex-direction:column;gap:7px}.order-brief>.full-width{grid-column:1/-1}.order-brief span{font-size:12px;color:#6d776f}.order-brief b{font-size:13px;line-height:1.6}.status-form{margin-top:18px}
</style>
