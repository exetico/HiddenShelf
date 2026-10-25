// Public link page (link.html), served at /h/:hash. A separate entry from
// the main app so visitors don't load the dashboard, router or auth.
import { createApp } from "vue";
import PublicLinkPage from "./PublicLinkPage.vue";
import "../styles.css";

createApp(PublicLinkPage).mount("#app");
