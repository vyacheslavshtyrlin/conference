import { useEffect, useMemo, useState } from "react";

type Route =
  | { name: "create" }
  | { name: "prejoin"; slug: string }
  | { name: "conference"; slug: string };

function parsePath(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "r" && parts[1] && parts[2] === "live") {
    return { name: "conference", slug: parts[1] };
  }

  if (parts[0] === "r" && parts[1]) {
    return { name: "prejoin", slug: parts[1] };
  }

  return { name: "create" };
}

export function useRoute(): Route {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleChange = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", handleChange);
    return () => window.removeEventListener("popstate", handleChange);
  }, []);

  return useMemo(() => parsePath(pathname), [pathname]);
}
