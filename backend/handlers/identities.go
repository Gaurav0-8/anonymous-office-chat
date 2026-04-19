package handlers

// DisplayNames is the canonical list of 50 predefined anonymous display names used in auth.go
var DisplayNames = []string{
	"Crimson Phoenix", "Azure Dragon", "Emerald Wolf", "Golden Eagle", "Silver Fox", 
	"Violet Raven", "Amber Tiger", "Sapphire Hawk", "Ruby Panther", "Jade Serpent", 
	"Obsidian Bear", "Pearl Dove", "Onyx Falcon", "Coral Lynx", "Ivory Owl", 
	"Copper Stag", "Bronze Lion", "Platinum Shark", "Cobalt Whale", "Scarlet Viper", 
	"Indigo Crane", "Turquoise Otter", "Magenta Butterfly", "Cyan Dolphin", 
	"Maroon Stallion", "Teal Sparrow", "Lavender Swan", "Mint Hummingbird", 
	"Peach Gazelle", "Slate Raven", "Charcoal Badger", "Cream Rabbit", 
	"Burgundy Leopard", "Navy Penguin", "Olive Tortoise", "Rust Coyote", 
	"Sand Camel", "Storm Albatross", "Frost Lynx", "Ember Salamander", 
	"Mist Heron", "Dawn Nightingale", "Dusk Bat", "Eclipse Moth", 
	"Sunset Flamingo", "Midnight Panther", "Twilight Owl", "Aurora Fox", 
	"Nebula Wolf", "Comet Cheetah",
}

// IsValidDisplayName checks if name is in the predefined list
func IsValidDisplayName(name string) bool {
	for _, n := range DisplayNames {
		if n == name { return true }
	}
	return false
}
