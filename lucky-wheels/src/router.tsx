import { PATHS } from "@/constants/path";
import { AnimationRoutes, Route, ZMPRouter } from "zmp-ui";
import HomePage from "./pages/home";
import { lazy, Suspense } from "react";

const RewardPage = lazy(() => import("./pages/reward"));
const VoucherPage = lazy(() => import("./pages/voucher"));
const WheelPage = lazy(() => import("./pages/wheel"));

const routes = [
  { path: PATHS.HOME, element: <HomePage /> },
  { path: PATHS.REWARD, element: <RewardPage /> },
  { path: PATHS.WHEEL, element: <WheelPage /> },
  { path: PATHS.VOUCHER, element: <VoucherPage /> },
];

export default function AppRouter() {
  return (
    <ZMPRouter>
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 text-amber-300 grid place-items-center text-sm font-bold">
            Đang tải...
          </div>
        }
      >
        <AnimationRoutes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </AnimationRoutes>
      </Suspense>
    </ZMPRouter>
  );
}
