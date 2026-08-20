<template>
  <div>
    <PageHeader title="日历节日提醒" description="管理国内外节日和自定义节日，小程序日历仅展示节日与用户 BIG DAY。">
      <el-button type="primary" @click="openCreate">新增自定义节日</el-button>
    </PageHeader>
    <el-alert v-if="!collectionReady" class="collection-alert" type="warning" :closable="false" title="请先在 CloudBase 数据库创建空集合 calendarEvents。" />
    <el-card shadow="never" class="panel-card">
      <div class="filter-bar"><el-input v-model="filters.keyword" clearable placeholder="搜索节日名称或说明"/><el-select v-model="filters.region" clearable placeholder="全部分类"><el-option label="国内节日" value="domestic"/><el-option label="国际节日" value="international"/></el-select><el-button :loading="loading" @click="loadData">刷新</el-button></div>
      <el-table v-loading="loading" :data="filteredItems" row-key="eventKey">
        <el-table-column label="分类" width="110"><template #default="{row}"><el-tag effect="plain">{{ row.region === 'international' ? '国际' : '国内' }}</el-tag></template></el-table-column>
        <el-table-column label="节日" min-width="190"><template #default="{row}"><strong>{{row.name}}</strong><div class="table-secondary">{{row.builtIn?'内置节日':'自定义节日'}}</div></template></el-table-column>
        <el-table-column label="日期" min-width="160"><template #default="{row}">{{formatRule(row.rule)}}</template></el-table-column>
        <el-table-column label="推荐文案" min-width="260"><template #default="{row}"><strong>{{row.title||row.name}}</strong><div class="table-secondary">{{row.description||'未配置说明'}}</div></template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="{row}"><StatusDot :text="row.enabled?'启用':'停用'" :type="row.enabled?'success':'muted'"/></template></el-table-column>
        <el-table-column label="操作" width="160" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="removeOrReset(row)">{{row.builtIn?'恢复默认':'删除'}}</el-button></template></el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="form.eventKey?'编辑节日':'新增自定义节日'" width="720px" destroy-on-close>
      <el-form label-position="top">
        <div class="two-column"><el-form-item label="节日名称" required><el-input v-model="form.name" :disabled="form.builtIn"/></el-form-item><el-form-item label="类型"><el-select v-model="form.region" :disabled="form.builtIn"><el-option label="国内节日" value="domestic"/><el-option label="国际节日" value="international"/></el-select></el-form-item></div>
        <el-form-item v-if="form.builtIn" label="日期规则"><el-input :model-value="formatRule(form.rule)" disabled/></el-form-item>
        <div v-else class="two-column"><el-form-item label="月份"><el-input-number v-model="form.month" :min="1" :max="12"/></el-form-item><el-form-item label="日期"><el-input-number v-model="form.day" :min="1" :max="31"/></el-form-item></div>
        <el-form-item label="推荐标题"><el-input v-model="form.title"/></el-form-item><el-form-item label="节日说明"><el-input v-model="form.description" type="textarea" :rows="4"/></el-form-item>
        <el-form-item label="关联商品"><el-select v-model="form.productIds" multiple filterable style="width:100%"><el-option v-for="product in products" :key="product._id" :label="product.name" :value="product._id"/></el-select></el-form-item>
        <div class="setting-row"><div><strong>在日历中显示</strong><span>关闭后顾客端不展示</span></div><el-switch v-model="form.enabled"/></div>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import {computed,onMounted,reactive,ref} from 'vue';import {ElMessageBox} from 'element-plus';import PageHeader from '../components/PageHeader.vue';import StatusDot from '../components/StatusDot.vue';import {adminApi} from '../services/admin';import {feedback} from '../utils/feedback'
const loading=ref(false),saving=ref(false),dialogVisible=ref(false),collectionReady=ref(true),items=ref([]),products=ref([]);const filters=reactive({keyword:'',region:''});const empty=()=>({eventKey:'',builtIn:false,name:'',region:'domestic',rule:null,month:1,day:1,title:'',description:'',categoryIntent:'推荐花束',searchKeywords:[],productIds:[],recommendationEnabled:true,enabled:true,sort:100});const form=reactive(empty())
const filteredItems=computed(()=>items.value.filter(row=>{if(filters.region&&row.region!==filters.region)return false;const key=filters.keyword.trim().toLowerCase();return !key||[row.name,row.title,row.description].join(' ').toLowerCase().includes(key)}));function formatRule(rule){if(!rule)return'—';if(rule.type==='fixed')return`${rule.month}月${rule.day}日`;return'自定义日期'}
async function loadData(){loading.value=true;try{const [events,productResult]=await Promise.all([adminApi.listCalendarEvents(),adminApi.listProducts({})]);items.value=(events.items||[]).filter(i=>i.region!=='merchant');products.value=productResult.items||[];collectionReady.value=events.collectionReady!==false}catch(e){feedback.error(e,'节日加载失败')}finally{loading.value=false}}
function openCreate(){Object.assign(form,empty());dialogVisible.value=true}function openEdit(row){Object.assign(form,empty(),JSON.parse(JSON.stringify(row)));if(row.rule?.type==='fixed'){form.month=row.rule.month;form.day=row.rule.day}dialogVisible.value=true}
async function save(){if(!form.name){feedback.warning('请输入节日名称');return}saving.value=true;try{await adminApi.saveCalendarEvent({...form,rule:form.builtIn?form.rule:{type:'fixed',month:form.month,day:form.day}});feedback.success('节日已保存');dialogVisible.value=false;await loadData()}catch(e){feedback.error(e,'保存失败')}finally{saving.value=false}}
async function removeOrReset(row){try{await ElMessageBox.confirm(row.builtIn?'恢复该节日默认配置吗？':`删除“${row.name}”吗？`,'确认操作',{type:'warning'});await adminApi.deleteCalendarEvent(row.eventKey);feedback.success('操作完成');await loadData()}catch(e){if(e!=='cancel'&&e!=='close')feedback.error(e,'操作失败')}}onMounted(loadData)
</script>