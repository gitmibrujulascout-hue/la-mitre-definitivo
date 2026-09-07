const paletteScale = (token) => ({
	50: `hsl(var(--${token}-50) / <alpha-value>)`,
	100: `hsl(var(--${token}-100) / <alpha-value>)`,
	200: `hsl(var(--${token}-200) / <alpha-value>)`,
	300: `hsl(var(--${token}-300) / <alpha-value>)`,
	400: `hsl(var(--${token}-400) / <alpha-value>)`,
	500: `hsl(var(--${token}-500) / <alpha-value>)`,
	600: `hsl(var(--${token}-600) / <alpha-value>)`,
	700: `hsl(var(--${token}-700) / <alpha-value>)`,
	800: `hsl(var(--${token}-800) / <alpha-value>)`,
	900: `hsl(var(--${token}-900) / <alpha-value>)`,
});

const forestScale = paletteScale('forest');
const sageScale = paletteScale('sage');
const emberScale = paletteScale('ember');
const warmScale = paletteScale('warm');
const dangerScale = paletteScale('danger');

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			inter: ['var(--font-inter)']
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
			white: 'hsl(38 52% 96% / <alpha-value>)',
			black: 'hsl(159 67% 7% / <alpha-value>)',
			green: forestScale,
			emerald: forestScale,
			teal: forestScale,
			lime: forestScale,
			blue: sageScale,
			cyan: sageScale,
			sky: sageScale,
			yellow: emberScale,
			amber: emberScale,
			orange: emberScale,
			indigo: emberScale,
			violet: emberScale,
			purple: emberScale,
			fuchsia: emberScale,
			pink: emberScale,
			red: dangerScale,
			rose: dangerScale,
			slate: warmScale,
			gray: warmScale,
			zinc: warmScale,
			neutral: warmScale,
			stone: warmScale,
			background: 'hsl(var(--background))',
			foreground: 'hsl(var(--foreground))',
			forest: {
				DEFAULT: 'hsl(var(--forest) / <alpha-value>)',
				deep: 'hsl(var(--forest-deep) / <alpha-value>)',
				soft: 'hsl(var(--forest-soft) / <alpha-value>)'
			},
			ember: {
				DEFAULT: 'hsl(var(--ember) / <alpha-value>)',
				hover: 'hsl(var(--ember-hover) / <alpha-value>)',
				soft: 'hsl(var(--ember-soft) / <alpha-value>)'
			},
			cream: {
				DEFAULT: 'hsl(var(--cream) / <alpha-value>)',
				surface: 'hsl(var(--cream-surface) / <alpha-value>)',
				muted: 'hsl(var(--cream-muted) / <alpha-value>)'
			},
			rama: {
				lobatos: 'hsl(var(--rama-lobatos) / <alpha-value>)',
				tropa: 'hsl(var(--rama-tropa) / <alpha-value>)',
				km: 'hsl(var(--rama-km) / <alpha-value>)',
				rovers: 'hsl(var(--rama-rovers) / <alpha-value>)',
				adultos: 'hsl(var(--rama-adultos) / <alpha-value>)',
				educador: 'hsl(var(--rama-educador) / <alpha-value>)'
			},
			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
