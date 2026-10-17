import { createApp } from 'vue'
import App from './App.vue' // or App.vue
import router from './router'

// Import Bootstrap CSS globally
import 'bootstrap/dist/css/bootstrap.min.css'

const app = createApp(App)
app.use(router)
app.mount('#app')


