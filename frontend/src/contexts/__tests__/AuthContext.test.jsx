import axios from "axios";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

import { client, resetRefreshPromiseForTests } from "../AuthContext";

describe("AuthContext - Singleton Refresh Interceptor", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRefreshPromiseForTests();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    resetRefreshPromiseForTests();
    jest.restoreAllMocks();
  });

  test("two parallel 401s trigger exactly one network call to /refresh", async () => {
    localStorage.setItem("accessToken", "expired-access-token");
    localStorage.setItem("refreshToken", "valid-refresh-token");

    // Spy on axios.post used by interceptor to call /refresh
    const refreshSpy = jest.spyOn(axios, "post").mockImplementation(async (url) => {
      if (url.includes("/refresh")) {
        // Small delay to simulate in-flight network request
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          data: {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            user: { id: "user-123", name: "Alice" },
          },
        };
      }
      return Promise.reject(new Error("Unexpected POST"));
    });

    // Mock client internal dispatch to return 401 on initial call, and 200 on retry
    let call1Attempts = 0;
    let call2Attempts = 0;

    const originalAdapter = client.defaults.adapter;
    client.defaults.adapter = async (config) => {
      if (config.url === "/endpoint-1") {
        call1Attempts++;
        if (call1Attempts === 1) {
          const err = new Error("Request failed with status code 401");
          err.response = { status: 401, data: { message: "Token expired" } };
          err.config = config;
          throw err;
        }
        return {
          data: { success: true, call: 1 },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }

      if (config.url === "/endpoint-2") {
        call2Attempts++;
        if (call2Attempts === 1) {
          const err = new Error("Request failed with status code 401");
          err.response = { status: 401, data: { message: "Token expired" } };
          err.config = config;
          throw err;
        }
        return {
          data: { success: true, call: 2 },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      }

      return Promise.reject(new Error(`Unhandled url: ${config.url}`));
    };

    try {
      // Fire two parallel requests that both return 401
      const [res1, res2] = await Promise.all([
        client.get("/endpoint-1"),
        client.get("/endpoint-2"),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.data.success).toBe(true);
      expect(res2.data.success).toBe(true);

      // Verify /refresh was called EXACTLY ONCE
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith(
        expect.stringContaining("/refresh"),
        { refreshToken: "valid-refresh-token" }
      );

      // Verify new tokens are saved in localStorage
      expect(localStorage.getItem("accessToken")).toBe("new-access-token");
      expect(localStorage.getItem("refreshToken")).toBe("new-refresh-token");
    } finally {
      client.defaults.adapter = originalAdapter;
    }
  });
});
