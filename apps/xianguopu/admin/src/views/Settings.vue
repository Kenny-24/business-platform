<template>
  <div class="panel settings-panel">
    <div class="toolbar"><h2 class="page-title">店铺设置</h2><div class="spacer"/><el-button type="primary" :loading="saving" @click="save">保存设置</el-button></div>
    <el-form label-position="top" style="max-width:720px">
      <div class="two">
        <el-form-item label="店铺名称"><el-input v-model="form.storeName"/></el-form-item>
        <el-form-item label="品牌标语"><el-input v-model="form.slogan"/></el-form-item>
        <el-form-item label="基础运费（元）"><el-input-number v-model="form.baseFreight" :min="0" :precision="2" style="width:100%"/></el-form-item>
        <el-form-item label="满额包邮（元）"><el-input-number v-model="form.freeShippingThreshold" :min="0" :precision="2" style="width:100%"/></el-form-item>
      </div>
      <el-form-item label="全国销售架构"><el-switch v-model="form.nationwideEnabled" active-text="启用全国商品体系"/></el-form-item>
      <el-form-item label="售后说明"><el-input v-model="form.afterSaleText" type="textarea" :rows="4"/></el-form-item>
      <el-alert type="info" :closable="false" title="当前为全店统一运费规则。正式全国运营时建议继续扩展为省份/仓库/重量阶梯运费模板，并接入真实物流报价。"/>
    </el-form>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { ElMessage } from 'element-plus';
const saving=ref(false);const form=reactive<any>({storeName:'鲜果铺',slogan:'把新鲜送到家',baseFreight:8,freeShippingThreshold:99,nationwideEnabled:true,afterSaleText:''});
onMounted(async()=>Object.assign(form,await api.get('/admin/settings/store')));
async function save(){saving.value=true;try{await api.put('/admin/settings/store',form);ElMessage.success('设置已保存')}finally{saving.value=false}}
</script>
<style scoped>.two{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.settings-panel{min-height:520px}</style>
