import { mount } from "svelte";
import About from "./About.svelte";
import "./app.css";

const app = mount(About, { target: document.getElementById("app")! });

export default app;
