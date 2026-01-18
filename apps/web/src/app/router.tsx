import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { About } from "./routes/About";
import { Home } from "./routes/Home";
import { HowItWorks } from "./routes/HowItWorks";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "how-it-works",
        element: <HowItWorks />,
      },
      {
        path: "about",
        element: <About />,
      },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
