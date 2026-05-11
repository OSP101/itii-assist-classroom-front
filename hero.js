const { heroui } = require("@heroui/theme");

module.exports = heroui({
	themes: {
		light: {
			extend: "light",
			colors: {
				background: { DEFAULT: "#f4f7fb" },
				foreground: { DEFAULT: "#0f172a" },
				divider: { DEFAULT: "rgba(15, 23, 42, 0.10)" },
				overlay: { DEFAULT: "rgba(15, 23, 42, 0.55)" },
				content1: { DEFAULT: "#ffffff", foreground: "#0f172a" },
				content2: { DEFAULT: "#f8fafc", foreground: "#0f172a" },
				content3: { DEFAULT: "#eef4ff", foreground: "#1e293b" },
				content4: { DEFAULT: "#e2e8f0", foreground: "#334155" },
			},
		},
		dark: {
			extend: "dark",
			colors: {
				background: { DEFAULT: "#0b1220" },
				foreground: { DEFAULT: "#e7edf7" },
				divider: { DEFAULT: "rgba(148, 163, 184, 0.18)" },
				overlay: { DEFAULT: "rgba(2, 6, 23, 0.72)" },
				content1: { DEFAULT: "#111a2d", foreground: "#e7edf7" },
				content2: { DEFAULT: "#172236", foreground: "#dde7f6" },
				content3: { DEFAULT: "#1f2d45", foreground: "#d3deee" },
				content4: { DEFAULT: "#2a3954", foreground: "#e2e8f0" },
			},
		},
	},
});
