<template>
  <div class="panel">
    <div class="toolbar">
      <div><h2 class="page-title">水果分类</h2><p class="page-desc">用于小程序分类导航与商品归档</p></div>
      <div class="spacer" />
      <el-button type="primary" @click="edit()">新增分类</el-button>
    </div>
    <el-table v-loading="loading" :data="items" row-key="id">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="图标" width="90"><template #default="scope"><span class="category-icon">{{ scope.row.icon }}</span></template></el-table-column>
      <el-table-column prop="name" label="分类名称" />
      <el-table-column prop="sort" label="排序" width="100" />
      <el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.enabled?'success':'info'">{{ scope.row.enabled?'启用':'停用' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="150"><template #default="scope"><el-button link type="primary" @click="edit(scope.row)">编辑</el-button><el-button link type="danger" @click="remove(scope.row)">删除</el-button></template></el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="visible" :title="form.id?'编辑分类':'新增分类'" width="440px">
    <el-form label-position="top">
      <el-form-item label="分类名称"><el-input v-model="form.name" maxlength="20" /></el-form-item>
      <el-form-item label="Emoji 图标"><el-input v-model="form.icon" maxlength="4" /></el-form-item>
      <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
      <el-form-item label="状态"><el-switch v-model="form.enabled" active-text="启用" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const items=ref<any[]>([]);
const visible=ref(false);
const loading=ref(false);
const saving=ref(false);
const form=reactive<any>({id:0,name:'',icon:'🍏',sort:0,enabled:true});

async function load(){
  loading.value=true;
  try{ items.value=await api.get('/admin/categories'); }
  catch(error:any){ ElMessage.error(error.response?.data?.message||'分类加载失败'); }
  finally{ loading.value=false; }
}
function edit(row?:any){ Object.assign(form,row||{id:0,name:'',icon:'🍏',sort:0,enabled:true}); visible.value=true; }
async function save(){
  if(!form.name.trim()) return ElMessage.warning('请填写分类名称');
  const{id,...data}=form;
  saving.value=true;
  try{ id?await api.put(`/admin/categories/${id}`,data):await api.post('/admin/categories',data); visible.value=false; ElMessage.success('分类已保存'); await load(); }
  catch(error:any){ ElMessage.error(error.response?.data?.message||'分类保存失败'); }
  finally{ saving.value=false; }
}
async function remove(row:any){
  try{ await ElMessageBox.confirm(`删除分类“${row.name}”？`,'确认删除'); await api.delete(`/admin/categories/${row.id}`); ElMessage.success('分类已删除'); await load(); }
  catch(error:any){ if(error!=='cancel'&&error!=='close') ElMessage.error(error.response?.data?.message||'删除失败'); }
}
onMounted(load);
</script>

<style scoped>
.page-desc{margin:6px 0 0;color:#929a94;font-size:12px}.category-icon{font-size:25px}
</style>
