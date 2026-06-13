import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "violet",
  defaultRadius: "md",
  fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  headings: {
    fontFamily: "'Syne', ui-sans-serif, system-ui, sans-serif",
  },
  colors: {
    violet: [
      "#f1e8ff",
      "#dfccff",
      "#bd9cff",
      "#9968ff",
      "#7d3dff",
      "#6c22ff",
      "#6217f2",
      "#5211cf",
      "#450fb0",
      "#390d91",
    ],
    cyan: [
      "#ddfbff",
      "#b8f5ff",
      "#78ebff",
      "#37dfff",
      "#0bd5ff",
      "#00c4f5",
      "#00a9d4",
      "#008caf",
      "#08728e",
      "#0b5a72",
    ],
    dark: [
      "#dbe5ff",
      "#aebce8",
      "#8090bd",
      "#586a96",
      "#364873",
      "#243354",
      "#17243f",
      "#0d1730",
      "#070f22",
      "#030713",
    ],
  },
  components: {
    Button: { defaultProps: { radius: "md" } },
    Drawer: {
      styles: {
        content: { backgroundColor: "#0d1730", borderLeft: "1px solid rgba(157,139,255,0.16)" },
        header: { backgroundColor: "#0d1730", borderBottom: "1px solid rgba(157,139,255,0.16)" },
        title: { fontFamily: "'Syne', sans-serif", fontWeight: "700", fontSize: "15px" },
      },
    },
    Modal: {
      styles: {
        content: { backgroundColor: "#0d1730", border: "1px solid rgba(157,139,255,0.16)" },
        header: { backgroundColor: "#0d1730" },
      },
    },
  },
});
