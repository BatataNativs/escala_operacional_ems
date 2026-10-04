import { onRequestGet as __api_auth_js_onRequestGet } from "C:\\Users\\dougl\\dev\\HTML\\escala_operacional\\functions\\api\\auth.js"
import { onRequestPost as __api_auth_js_onRequestPost } from "C:\\Users\\dougl\\dev\\HTML\\escala_operacional\\functions\\api\\auth.js"
import { onRequestGet as __api_escala_js_onRequestGet } from "C:\\Users\\dougl\\dev\\HTML\\escala_operacional\\functions\\api\\escala.js"
import { onRequestPost as __api_escala_js_onRequestPost } from "C:\\Users\\dougl\\dev\\HTML\\escala_operacional\\functions\\api\\escala.js"

export const routes = [
    {
      routePath: "/api/auth",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_js_onRequestGet],
    },
  {
      routePath: "/api/auth",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_js_onRequestPost],
    },
  {
      routePath: "/api/escala",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_escala_js_onRequestGet],
    },
  {
      routePath: "/api/escala",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_escala_js_onRequestPost],
    },
  ]