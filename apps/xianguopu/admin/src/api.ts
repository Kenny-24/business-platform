import axios from 'axios';
const client=axios.create({baseURL:'/api',timeout:12000});
client.interceptors.request.use(c=>{const t=localStorage.getItem('admin_token');if(t)c.headers.Authorization=`Bearer ${t}`;return c});
client.interceptors.response.use(r=>r,e=>{if(e.response?.status===401){localStorage.removeItem('admin_token');if(location.pathname!='/login')location.href='/login'}return Promise.reject(e)});
export const api={
  get:<T=any>(url:string,config?:any):Promise<T>=>client.get(url,config).then(r=>r.data),
  post:<T=any>(url:string,data?:any,config?:any):Promise<T>=>client.post(url,data,config).then(r=>r.data),
  put:<T=any>(url:string,data?:any,config?:any):Promise<T>=>client.put(url,data,config).then(r=>r.data),
  delete:<T=any>(url:string,config?:any):Promise<T>=>client.delete(url,config).then(r=>r.data),
};
export { client };
