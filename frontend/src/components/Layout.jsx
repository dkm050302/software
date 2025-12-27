import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Collapse,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Note as NoteIcon,
  Map as MapIcon,
  Error as ErrorIcon,
  FamilyRestroom as FamilyIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  MenuBook as MenuBookIcon,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";

const drawerWidth = 240;

export default function Layout() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [errorBookOpen, setErrorBookOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userType");
    localStorage.removeItem("studentId");
    navigate("/login");
  };

  // 从token中获取用户类型，而不是从localStorage
  const getUserTypeFromToken = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.user_type;
    } catch (e) {
      return null;
    }
  };

  // 检查是否是管理员身份
  const isAdmin = () => {
    return getUserTypeFromToken() === "admin";
  };

  // 检查是否是教师身份
  const isTeacher = () => {
    return getUserTypeFromToken() === "teacher";
  };

  // 如果是管理员，只显示管理员界面
  let menuItems = [];
  if (isAdmin()) {
    menuItems = [{ text: "管理员界面", icon: <AdminIcon />, path: "/admin" }];
  } else {
    // 非管理员显示常规菜单
    menuItems = [
      { text: "Dashboard", icon: <DashboardIcon />, path: "/" },
      { text: "Note Assistant", icon: <NoteIcon />, path: "/notes" },
      { text: "Map Generation", icon: <MapIcon />, path: "/maps" },
      { text: "Error Book", icon: <ErrorIcon />, path: "/errors" },
      { text: "Parent View", icon: <FamilyIcon />, path: "/parents" },
    ];

    // 只有教师才能看到教学大纲
    if (isTeacher()) {
      menuItems.push({
        text: "教学大纲",
        icon: <MenuBookIcon />,
        path: "/syllabus",
      });
    }
  }

  const getUserType = () => {
    return getUserTypeFromToken() || "unknown";
  };

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          AI Tutor
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => {
          if (item.text === "Error Book") {
            return (
              <React.Fragment key={item.text}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => setErrorBookOpen(!errorBookOpen)}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                    {errorBookOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={errorBookOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    <ListItemButton 
                      sx={{ pl: 4 }} 
                      selected={location.pathname === '/errors/create'} 
                      onClick={() => navigate('/errors/create')}
                    >
                      <ListItemText primary="Create Error Book" />
                    </ListItemButton>
                    <ListItemButton 
                      sx={{ pl: 4 }} 
                      selected={location.pathname === '/errors/view'} 
                      onClick={() => navigate('/errors/view')}
                    >
                      <ListItemText primary="View Error Book" />
                    </ListItemButton>
                  </List>
                </Collapse>
              </React.Fragment>
            );
          }
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ p: 2, textAlign: "left" }}>
        <Typography sx={{ fontSize: "28px", color: "text.secondary" }}>
          welcome
        </Typography>
        <Typography sx={{ fontSize: "22px", color: "text.secondary", mt: 0.5 }}>
          {getUserType()}!
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {menuItems.find((item) => item.path === location.pathname)?.text ||
              "AI Tutor"}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
