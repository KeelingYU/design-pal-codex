// 来自已确认样稿的库规则与配色；仅颜色对象参与切色。
export const colorKeys = ["canvas","surface","raised","line","text","muted","accent","onAccent","tint","danger","success"];
export const libraries = {
  "order": {
    "name": "规整",
    "subtitle": "精密工作台",
    "icon": "regular",
    "layout": "table",
    "detail": "drawer",
    "description": "侧栏组织信息，表格集中处理，详情从侧边打开。",
    "fit": [
      "数据管理",
      "SaaS 工具",
      "客户管理"
    ],
    "avoid": "以情绪表达和大图浏览为主的产品。",
    "shape": "4px 小圆角 · 细分隔线",
    "motion": "160ms 快速侧滑",
    "interaction": "侧边抽屉 · 单项展开",
    "colors": [
      {
        "id": "indigo",
        "name": "靛青",
        "description": "冷静蓝调，突出关键操作与数据层级。",
        "light": {
          "canvas": "#f5f7fc",
          "surface": "#ffffff",
          "raised": "#eef1f8",
          "line": "#d4dbe8",
          "text": "#1c2940",
          "muted": "#596a82",
          "accent": "#435bd5",
          "onAccent": "#ffffff",
          "tint": "#e9edff",
          "danger": "#b82d40",
          "success": "#26724b"
        },
        "dark": {
          "canvas": "#131925",
          "surface": "#1a2232",
          "raised": "#232e42",
          "line": "#394860",
          "text": "#e7edf8",
          "muted": "#a1b0c8",
          "accent": "#a9b9ff",
          "onAccent": "#16213d",
          "tint": "#283858",
          "danger": "#ff9da9",
          "success": "#8fdaad"
        }
      },
      {
        "id": "slate",
        "name": "岩灰",
        "description": "低饱和灰绿，适合长时间处理业务。",
        "light": {
          "canvas": "#f4f6f5",
          "surface": "#ffffff",
          "raised": "#eaf0ed",
          "line": "#ccd8d1",
          "text": "#23362e",
          "muted": "#5a6f64",
          "accent": "#416851",
          "onAccent": "#ffffff",
          "tint": "#e6f0e9",
          "danger": "#b43242",
          "success": "#226846"
        },
        "dark": {
          "canvas": "#151e19",
          "surface": "#1e2b24",
          "raised": "#283930",
          "line": "#415c4b",
          "text": "#e8f3eb",
          "muted": "#a6bdae",
          "accent": "#a4d1b1",
          "onAccent": "#142f20",
          "tint": "#2c4b36",
          "danger": "#ffa6ae",
          "success": "#94ddb2"
        }
      }
    ]
  },
  "ease": {
    "name": "松弛",
    "subtitle": "舒展内容空间",
    "icon": "fill",
    "layout": "cards",
    "detail": "modal",
    "description": "顶部导航留出整幅空间，卡片承载内容，弹窗聚焦当前操作。",
    "fit": [
      "知识管理",
      "内容管理",
      "个人效率"
    ],
    "avoid": "需要同屏查看大量明细或快速连续操作的控制台。",
    "shape": "18px 大圆角 · 柔和层次",
    "motion": "320ms 弹性缩放",
    "interaction": "居中弹窗 · 多项展开",
    "colors": [
      {
        "id": "clay",
        "name": "陶土",
        "description": "温暖纸色，适合阅读和内容整理。",
        "light": {
          "canvas": "#f5f0e9",
          "surface": "#fffdf8",
          "raised": "#eee5d9",
          "line": "#d9cabc",
          "text": "#3e302a",
          "muted": "#7b665b",
          "accent": "#994c32",
          "onAccent": "#ffffff",
          "tint": "#f6e1d5",
          "danger": "#ae313c",
          "success": "#4b704e"
        },
        "dark": {
          "canvas": "#221c19",
          "surface": "#302622",
          "raised": "#3e3029",
          "line": "#634a3f",
          "text": "#f5e8df",
          "muted": "#c2a89b",
          "accent": "#efb391",
          "onAccent": "#392015",
          "tint": "#52392d",
          "danger": "#ffa2a7",
          "success": "#b3d4a0"
        }
      },
      {
        "id": "sage",
        "name": "鼠尾草",
        "description": "轻柔绿调，让内容空间更舒展。",
        "light": {
          "canvas": "#eef3ed",
          "surface": "#fbfdf9",
          "raised": "#e1eadd",
          "line": "#c8d4c2",
          "text": "#28392b",
          "muted": "#5f725e",
          "accent": "#456d4c",
          "onAccent": "#ffffff",
          "tint": "#deeddc",
          "danger": "#aa3741",
          "success": "#3c6a40"
        },
        "dark": {
          "canvas": "#192019",
          "surface": "#252f25",
          "raised": "#313e2f",
          "line": "#4a6147",
          "text": "#e8f2e4",
          "muted": "#acbfa7",
          "accent": "#bad9a4",
          "onAccent": "#21371a",
          "tint": "#3a5131",
          "danger": "#ffaab0",
          "success": "#b4dfa8"
        }
      }
    ]
  },
  "edge": {
    "name": "棱角",
    "subtitle": "紧凑任务控制台",
    "icon": "duotone",
    "layout": "split",
    "detail": "inline",
    "description": "紧凑列表与详情并排，选择即查看，不必来回开关浮层。",
    "fit": [
      "数据后台",
      "开发工具",
      "运营管理"
    ],
    "avoid": "强调柔和氛围、留白和长篇连续阅读的产品。",
    "shape": "直角 · 明确边线",
    "motion": "120ms 分段揭示",
    "interaction": "主从分栏 · 就地展开",
    "colors": [
      {
        "id": "ocean",
        "name": "深海",
        "description": "清晰蓝调，便于密集信息的定位。",
        "light": {
          "canvas": "#edf3f7",
          "surface": "#fafdff",
          "raised": "#e0ebf1",
          "line": "#b8ccda",
          "text": "#172f40",
          "muted": "#47677a",
          "accent": "#22658d",
          "onAccent": "#ffffff",
          "tint": "#d5e9f4",
          "danger": "#b52e3e",
          "success": "#23704e"
        },
        "dark": {
          "canvas": "#101a22",
          "surface": "#172631",
          "raised": "#203643",
          "line": "#365766",
          "text": "#e0f0f9",
          "muted": "#9ebcca",
          "accent": "#83c8ee",
          "onAccent": "#102b3c",
          "tint": "#224859",
          "danger": "#ffa0ae",
          "success": "#8edcb5"
        }
      },
      {
        "id": "amber",
        "name": "琥珀",
        "description": "暖金强调色，突出当前任务与反馈。",
        "light": {
          "canvas": "#f6f2e8",
          "surface": "#fffdf5",
          "raised": "#eee6d0",
          "line": "#d6c69d",
          "text": "#382f19",
          "muted": "#756342",
          "accent": "#8d5b17",
          "onAccent": "#ffffff",
          "tint": "#f6e8c2",
          "danger": "#ac3042",
          "success": "#43692f"
        },
        "dark": {
          "canvas": "#211d13",
          "surface": "#2d281b",
          "raised": "#403821",
          "line": "#63552f",
          "text": "#f5edda",
          "muted": "#c6b889",
          "accent": "#ebcb75",
          "onAccent": "#32250a",
          "tint": "#504322",
          "danger": "#ffa3ad",
          "success": "#b6d895"
        }
      }
    ]
  }
};
