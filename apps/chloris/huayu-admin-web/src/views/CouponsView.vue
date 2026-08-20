<template>
  <div>
    <PageHeader title="优惠券管理" description="管理新客券、日常满减券、复购券、售后补偿券与不定期惊喜券。">
      <el-button :loading="seeding" @click="seedRecommended">初始化推荐券</el-button>
      <el-button type="primary" @click="openCreate">新建优惠券</el-button>
    </PageHeader>

    <el-alert v-if="!collectionReady" type="warning" :closable="false" class="panel-card" title="请先在 CloudBase 数据库创建 coupons 和 userCoupons 两个空集合。" />

    <el-card shadow="never" class="panel-card">
      <el-table v-loading="loading" :data="items" row-key="_id">
        <el-table-column label="优惠券" min-width="230">
          <template #default="{ row }">
            <strong>{{ row.name }}</strong>
            <div class="table-secondary">{{ row.code }} · {{ row.autoTriggerLabel }}</div>
          </template>
        </el-table-column>
        <el-table-column label="优惠" width="150">
          <template #default="{ row }"><strong>减 ¥{{ row.discountText }}</strong><div class="table-secondary">{{ row.thresholdText }}</div></template>
        </el-table-column>
        <el-table-column label="有效期" min-width="180">
          <template #default="{ row }">
            <span v-if="row.validityType === 'relative'">领取后 {{ row.validDays }} 天</span>
            <span v-else>{{ row.startsAt }} 至 {{ row.endsAt }}</span>
          </template>
        </el-table-column>
        <el-table-column label="发放对象" width="150"><template #default="{ row }">{{ row.targetTypeLabel }}</template></el-table-column>
        <el-table-column label="发放 / 使用" width="140"><template #default="{ row }">{{ row.issuedCount }} / {{ row.usedCount }}</template></el-table-column>
        <el-table-column label="领取方式" width="130">
          <template #default="{ row }">
            <el-tag v-if="row.publicClaimable" type="warning" effect="plain">顾客可领取</el-tag>
            <span v-else class="table-secondary">后台 / 自动发放</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">{{ row.enabled ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" :disabled="!row.enabled" @click="openIssue(row)">发放</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !items.length" description="暂无优惠券" />
    </el-card>

    <el-dialog v-model="visible" :title="form._id ? '编辑优惠券' : '新建优惠券'" width="780px" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid form-grid--two">
          <el-form-item label="优惠券名称" required><el-input v-model="form.name" placeholder="例如：新客满99减15" /></el-form-item>
          <el-form-item label="优惠券编码"><el-input v-model="form.code" placeholder="留空自动生成" /></el-form-item>
        </div>
        <div class="form-grid form-grid--three">
          <el-form-item label="使用门槛（元）"><el-input-number v-model="thresholdYuan" :min="0" :precision="2" /></el-form-item>
          <el-form-item label="优惠金额（元）" required><el-input-number v-model="discountYuan" :min="0.01" :precision="2" /></el-form-item>
          <el-form-item label="每人累计限领"><el-input-number v-model="form.perUserLimit" :min="1" :max="999" /></el-form-item>
        </div>
        <div class="form-grid form-grid--two">
          <el-form-item label="每人最多同时持有（0不限）"><el-input-number v-model="form.maxActivePerUser" :min="0" :max="20" /></el-form-item>
          <el-form-item label="订单限制"><el-checkbox v-model="form.firstOrderOnly">仅限首个已付款订单使用</el-checkbox></el-form-item>
        </div>
        <div class="form-grid form-grid--two">
          <el-form-item label="有效期类型"><el-radio-group v-model="form.validityType"><el-radio-button label="relative">领取后有效</el-radio-button><el-radio-button label="fixed">固定日期</el-radio-button></el-radio-group></el-form-item>
          <el-form-item v-if="form.validityType === 'relative'" label="有效天数"><el-input-number v-model="form.validDays" :min="1" :max="365" /></el-form-item>
          <el-form-item v-else label="固定有效期"><el-date-picker v-model="fixedRange" type="datetimerange" value-format="YYYY-MM-DD HH:mm:ss" range-separator="至" /></el-form-item>
        </div>
        <div class="form-grid form-grid--two">
          <el-form-item label="默认发放对象"><el-select v-model="form.targetType"><el-option v-for="item in targetOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
          <el-form-item label="自动发放规则"><el-select v-model="form.autoTrigger"><el-option label="手动发放" value="none"/><el-option label="新用户注册后" value="newUser"/><el-option label="订单完成后" value="orderCompleted"/></el-select></el-form-item>
        </div>
        <el-form-item label="适用商品分类（不选表示全部普通商品）"><el-select v-model="form.applicableCategories" multiple clearable style="width:100%"><el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="排除分类"><el-select v-model="form.excludedCategories" multiple clearable style="width:100%"><el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="默认排除活动"><el-checkbox-group v-model="form.excludedCampaignTypes"><el-checkbox label="limited">限时推出</el-checkbox><el-checkbox label="valentine">情人节限定</el-checkbox><el-checkbox label="festival">节日预售</el-checkbox><el-checkbox label="seasonal">季节限定</el-checkbox></el-checkbox-group></el-form-item>
        <div class="form-grid form-grid--three">
          <el-form-item label="发放总量（0不限）"><el-input-number v-model="form.totalLimit" :min="0" /></el-form-item>
          <el-form-item label="预算上限（元，0不限）"><el-input-number v-model="budgetYuan" :min="0" :precision="2" /></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
        </div>
        <el-form-item label="使用说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <div class="setting-row"><div><strong>允许顾客主动领取</strong><span>开启后会展示在首页领券入口和领券中心；系统将自动设为全部顾客、手动领取</span></div><el-switch v-model="form.publicClaimable" /></div>
        <div class="setting-row"><div><strong>不定期惊喜券</strong><span>用于短期定向召回、淡季促销或库存调整</span></div><el-switch v-model="form.surprise" :disabled="form.publicClaimable" /></div>
        <div class="setting-row"><div><strong>启用优惠券</strong><span>停用后不再自动、手动或顾客主动领取</span></div><el-switch v-model="form.enabled" /></div>
      </el-form>
      <template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="issueVisible" title="发放优惠券" width="560px">
      <el-form label-position="top">
        <el-form-item label="优惠券"><el-input :model-value="issueForm.name" disabled /></el-form-item>
        <el-form-item label="发放对象"><el-select v-model="issueForm.targetType" style="width:100%"><el-option v-for="item in targetOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item v-if="issueForm.targetType === 'specificUser'" label="顾客"><el-select v-model="issueForm.userId" filterable style="width:100%"><el-option v-for="user in users" :key="user._id" :label="`${user.nickname || 'Chloris 用户'} · ${user._id}`" :value="user._id" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="issueVisible=false">取消</el-button><el-button type="primary" :loading="issuing" @click="issue">确认发放</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { adminApi } from '../services/admin'
import { feedback } from '../utils/feedback'

const loading=ref(false),saving=ref(false),issuing=ref(false),seeding=ref(false),visible=ref(false),issueVisible=ref(false),collectionReady=ref(true)
const items=ref([]),users=ref([])
const categoryOptions=[{value:'bouquet',label:'花礼/花束'},{value:'flower',label:'鲜切花材'},{value:'succulent',label:'多肉'},{value:'greenPlant',label:'绿植'},{value:'gift',label:'礼品'},{value:'vase',label:'花器'},{value:'tool',label:'工具'}]
const targetOptions=[{value:'all',label:'全部顾客'},{value:'neverPurchased',label:'注册未购买'},{value:'inactive30',label:'30天未购买'},{value:'inactive60',label:'60天未购买'},{value:'inactive90',label:'90天未购买'},{value:'specificUser',label:'指定顾客'}]
const empty=()=>({_id:'',code:'',name:'',description:'',thresholdFen:9900,discountFen:1500,validityType:'relative',validDays:7,startsAt:'',endsAt:'',applicableCategories:[],excludedCategories:[],excludedCampaignTypes:['limited','valentine','festival','seasonal'],totalLimit:0,perUserLimit:1,maxActivePerUser:0,firstOrderOnly:false,maxBudgetFen:0,targetType:'all',autoTrigger:'none',publicClaimable:false,surprise:false,enabled:true,sort:100})
const form=reactive(empty()),issueForm=reactive({id:'',name:'',targetType:'all',userId:''})
const thresholdYuan=computed({get:()=>form.thresholdFen/100,set:v=>form.thresholdFen=Math.round(Number(v||0)*100)})
const discountYuan=computed({get:()=>form.discountFen/100,set:v=>form.discountFen=Math.round(Number(v||0)*100)})
const budgetYuan=computed({get:()=>form.maxBudgetFen/100,set:v=>form.maxBudgetFen=Math.round(Number(v||0)*100)})
const fixedRange=computed({get:()=>form.startsAt&&form.endsAt?[form.startsAt,form.endsAt]:[],set:v=>{form.startsAt=v?.[0]||'';form.endsAt=v?.[1]||''}})
async function load(){loading.value=true;try{const [coupons,userResult]=await Promise.all([adminApi.listCoupons(),adminApi.listUsers({})]);items.value=coupons.items||[];users.value=userResult.items||[];collectionReady.value=coupons.collectionReady!==false&&coupons.userCouponCollectionReady!==false}catch(e){feedback.error(e,'优惠券加载失败')}finally{loading.value=false}}
function openCreate(){Object.assign(form,empty());visible.value=true} function openEdit(row){Object.assign(form,empty(),JSON.parse(JSON.stringify(row)));visible.value=true}
async function save(){if(!form.name){feedback.warning('请输入优惠券名称');return} saving.value=true;try{await adminApi.saveCoupon({...form});feedback.success('优惠券已保存');visible.value=false;await load()}catch(e){feedback.error(e,'保存失败')}finally{saving.value=false}}
function openIssue(row){Object.assign(issueForm,{id:row._id,name:row.name,targetType:row.targetType||'all',userId:''});issueVisible.value=true}
async function issue(){if(issueForm.targetType==='specificUser'&&!issueForm.userId){feedback.warning('请选择顾客');return}issuing.value=true;try{const result=await adminApi.issueCoupon(issueForm.id,{targetType:issueForm.targetType,userId:issueForm.userId});feedback.success(`已发放 ${result.issuedCount} 张，跳过 ${result.skippedCount} 张`);issueVisible.value=false;await load()}catch(e){feedback.error(e,'发放失败')}finally{issuing.value=false}}
async function remove(row){try{await ElMessageBox.confirm(`确定删除或停用“${row.name}”吗？已发放的券不会被删除。`,'处理优惠券',{type:'warning'});await adminApi.deleteCoupon(row._id);feedback.success('已处理');await load()}catch(e){if(e!=='cancel'&&e!=='close')feedback.error(e,'操作失败')}}
async function seedRecommended(){
  try{
    await ElMessageBox.confirm(
      '将创建新客券、日常满减券、复购券、售后补偿券和不定期惊喜券。已有相同编码的模板会自动跳过，不会重复创建。',
      '初始化推荐券',
      {
        type: 'info',
        customClass: 'chloris-message-box',
        confirmButtonText: '确认初始化',
        cancelButtonText: '取消',
        closeOnClickModal: false,
        closeOnPressEscape: true,
        distinguishCancelAndClose: true
      }
    )
    seeding.value=true
    const result=await adminApi.seedCoupons()
    feedback.success(`已创建 ${result.created} 个模板，跳过 ${result.skipped} 个已有模板`)
    await load()
  }catch(e){if(e!=='cancel'&&e!=='close')feedback.error(e,'初始化失败')}finally{seeding.value=false}
}
onMounted(load)
</script>
