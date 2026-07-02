APP_NAME := juyou-website-backend
LINUX_TARGET := x86_64-unknown-linux-musl
RELEASE_DIR := release
BINARY := $(RELEASE_DIR)/$(APP_NAME)
TARGET_BINARY := target/$(LINUX_TARGET)/release/$(APP_NAME)

.PHONY: dev build web backend check-cross clean

dev: web
	cargo run

build: clean check-cross web backend
	@mkdir -p "$(RELEASE_DIR)"
	@cp "$(TARGET_BINARY)" "$(BINARY)"
	@echo "Built Linux x86_64 binary: $(BINARY)"

web:
	pnpm --dir web build

check-cross:
	@command -v zig >/dev/null 2>&1 || { \
		echo "Error: zig is required for local Linux cross-compilation."; \
		echo "Install it with: brew install zig"; \
		exit 1; \
	}
	@cargo-zigbuild --version >/dev/null 2>&1 || { \
		echo "Error: cargo-zigbuild is required."; \
		echo "Install it with: cargo install cargo-zigbuild"; \
		exit 1; \
	}
	@rustup target list --installed | grep -q "^$(LINUX_TARGET)$$" || { \
		echo "Error: Rust target $(LINUX_TARGET) is not installed."; \
		echo "Install it with: rustup target add $(LINUX_TARGET)"; \
		exit 1; \
	}

backend:
	cargo zigbuild --release --target $(LINUX_TARGET)

clean:
	@rm -rf "$(RELEASE_DIR)"
