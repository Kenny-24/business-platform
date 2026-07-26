<template>
  <div>
    <PageHeader title="节日预售与限时活动" description="统一管理情人节预定、其他节日预售与活动商品。">
      <el-button type="primary" @click="openCreate">新建活动</el-button>
    </PageHeader>
    <el-alert type="info" :closable="false" show-icon title="活动启用且进入销售时间后，关联商品会自动出现在对应分类；活动结束后自动停止展示。" class="panel-card" />
    <el-card shadow="never" class="panel-card">
      <el-table v-loading="loading" :data="items" row-key="_id" class="clean-table">
        <el-table-column label="活动" min-width="220"><template #default="{row}"><strong>{{row.name}}</strong><div class="table-secondary">{{row.campaignCode}} · {{row.typeLabel}}</div></template></el-table-column>
        <el-table-column label="活动销售时间" min-width="220"><template #default="{row}">{{row.preSaleStartAt || '立即'}}<br>至 {{row.preSaleEndAt || '长期'}}</template></el-table-column>
        <el-table-column label="配送日期" min-width="180"><template #default="{row}">{{row.deliveryStartDate || '未限制'}} 至 {{row.deliveryEndDate || '未限制'}}</template></el-table-column>
        <el-table-column label="商品" min-width="200"><template #default="{row}">{{row.productNames?.join('、') || '尚未关联商品'}}</template></el-table-column>
        <el-table-column label="活动进度" min-width="180"><template #default="{row}"><div>订单 {{row.bookedOrders || 0}} / {{row.maxOrders || '不限'}}</div><div class="table-secondary">产能 {{row.bookedUnits || 0}} / {{row.maxUnits || '不限'}}</div></template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{row}"><el-tag :type="row.statusTone" effect="plain">{{row.statusLabel}}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="160" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="visible" :title="form._id ? '编辑活动' : '新建活动'" width="760px" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid form-grid--two"><el-form-item label="活动名称"><el-input v-model="form.name" placeholder="例如 2027 情人节预定" /></el-form-item><el-form-item label="活动类型"><el-select v-model="form.type"><el-option label="情人节预定" value="valentine"/><el-option label="节日预售" value="festival"/><el-option label="限时推出" value="limited"/><el-option label="季节限定" value="seasonal"/></el-select></el-form-item></div>
        <div class="form-grid form-grid--two"><el-form-item label="活动编码"><el-input v-model="form.campaignCode" placeholder="留空自动生成"/></el-form-item><el-form-item label="排序"><el-input-number v-model="form.sort" :min="0"/></el-form-item></div>
        <el-form-item label="展示标题"><el-input v-model="form.title"/></el-form-item><el-form-item label="活动说明"><el-input v-model="form.subtitle" type="textarea" :rows="3"/></el-form-item>
        <el-form-item label="活动销售时间"><el-date-picker v-model="presaleRange" type="datetimerange" value-format="YYYY-MM-DD HH:mm:ss" range-separator="至" start-placeholder="开始" end-placeholder="结束" /></el-form-item>
        <el-form-item label="允许配送日期"><el-date-picker v-model="deliveryRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="配送开始" end-placeholder="配送结束" /></el-form-item>
        <div class="form-grid form-grid--three"><el-form-item label="预约截止"><el-date-picker v-model="form.reservationDeadlineAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss"/></el-form-item><el-form-item label="最多订单"><el-input-number v-model="form.maxOrders" :min="0"/></el-form-item><el-form-item label="最多产能单位"><el-input-number v-model="form.maxUnits" :min="0"/></el-form-item></div>
        <el-form-item label="活动商品"><el-select v-model="form.productIds" multiple filterable style="width:100%"><el-option v-for="item in products" :key="item._id" :label="item.name" :value="item._id"/></el-select></el-form-item>
        <div class="setting-row"><div><strong>启用活动</strong><span>关闭后顾客端不展示活动商品</span></div><el-switch v-model="form.enabled"/></div>
      </el-form>
      <template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { computed,onMounted,reactive,ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'; import { adminApi } from '../services/admin'; import { feedback } from '../utils/feedback'
const loading=ref(false),saving=ref(false),visible=ref(false),items=ref([]),products=ref([])
const empty=()=>({_id:'',campaignCode:'',name:'',type:'valentine',title:'',subtitle:'',enabled:true,preSaleStartAt:'',preSaleEndAt:'',deliveryStartDate:'',deliveryEndDate:'',reservationDeadlineAt:'',maxOrders:0,maxUnits:0,productIds:[],sort:100})
const form=reactive(empty())
const presaleRange=computed({get:()=>form.preSaleStartAt&&form.preSaleEndAt?[form.preSaleStartAt,form.preSaleEndAt]:[],set:v=>{form.preSaleStartAt=v?.[0]||'';form.preSaleEndAt=v?.[1]||''}})
const deliveryRange=computed({get:()=>form.deliveryStartDate&&form.deliveryEndDate?[form.deliveryStartDate,form.deliveryEndDate]:[],set:v=>{form.deliveryStartDate=v?.[0]||'';form.deliveryEndDate=v?.[1]||''}})
async function load(){loading.value=true;try{const [a,p]=await Promise.all([adminApi.listFestivalCampaigns(),adminApi.listProducts({})]);items.value=a.items||[];products.value=p.items||[]}catch(e){feedback.error(e,'活动加载失败')}finally{loading.value=false}}
function openCreate(){Object.assign(form,empty());visible.value=true} function openEdit(row){Object.assign(form,empty(),JSON.parse(JSON.stringify(row)));visible.value=true}
async function save(){if(!form.name){feedback.warning('请输入活动名称');return} saving.value=true;try{await adminApi.saveFestivalCampaign({...form});feedback.success('活动已保存');visible.value=false;await load()}catch(e){feedback.error(e,'活动保存失败')}finally{saving.value=false}}
async function remove(row){try{await ElMessageBox.confirm(`确定删除“${row.name}”吗？关联商品会恢复为常规商品。`,'删除活动',{type:'warning'});await adminApi.deleteFestivalCampaign(row._id);feedback.success('活动已删除');await load()}catch(e){if(e!=='cancel'&&e!=='close')feedback.error(e,'删除失败')}}
onMounted(load)
</script>
