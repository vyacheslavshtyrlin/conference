import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  headings: {
    fontFamily: "'Syne', ui-sans-serif, system-ui, sans-serif",
  },
  colors: {
    teal: [
      "#e0faf3",
      "#c0f4e6",
      "#83e9cf",
      "#42ddb4",
      "#17d49f",
      "#00cc94",
      "#00c896",
      "#00af82",
      "#009c72",
      "#008862",
    ],
    // dark[7] = Mantine body background → used by Drawer, Paper, etc.
    dark: [
      "#c8d3de",
      "#8a9db8",
      "#677e96",
      "#475e74",
      "#2d4358",
      "#1c3047",
      "#112034",
      "#0a1020",
      "#060c18",
      "#030810",
    ],
  },
  components: {
    Button: { defaultProps: { radius: "md" } },
    Drawer: {
      styles: {
        content: { backgroundColor: "#0a1020", borderLeft: "1px solid rgba(255,255,255,0.07)" },
        header: { backgroundColor: "#0a1020", borderBottom: "1px solid rgba(255,255,255,0.07)" },
        title: { fontFamily: "'Syne', sans-serif", fontWeight: "700", fontSize: "15px" },
      },
    },
  },
});
