import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--bg-canvas, #0c0b0a)",
            color: "var(--text-primary, #f5f2eb)",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
              backgroundColor: "var(--surface-primary, #14120f)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
                color: "var(--color-primary, #f59e0b)",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-secondary, #a8a29e)",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              An unexpected error occurred while rendering this view. You can reload
              the page or return to the home dashboard.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  backgroundColor: "var(--color-primary, #f59e0b)",
                  color: "#000",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
              <a
                href="/home"
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.2))",
                  backgroundColor: "transparent",
                  color: "var(--text-primary, #f5f2eb)",
                  textDecoration: "none",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Go to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
