import { adminService } from "../services/admin.service.js";

export async function getUsers(req, res) {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const search = req.query.search;
  const result = await adminService.getUsers(page, pageSize, search);
  res.json(result);
}

export async function getUserById(req, res) {
  const user = await adminService.getUserById(req.params.id);
  res.json(user);
}

export async function updateUserStatus(req, res) {
  const { role } = req.body;
  const user = await adminService.updateUserStatus(req.params.id, role);
  res.json(user);
}

export async function deleteUser(req, res) {
  const result = await adminService.deleteUser(req.params.id);
  res.json(result);
}

export async function getAnalytics(req, res) {
  const analytics = await adminService.getAnalytics();
  res.json(analytics);
}
